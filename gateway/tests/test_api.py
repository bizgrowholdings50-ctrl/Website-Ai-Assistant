"""Tests for WebClaw Gateway API endpoints."""

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import main
from main import (
    MAX_QA_CONTEXT_CHARS,
    TOOL_DECLARATIONS,
    _build_live_config,
    _build_qa_user_prompt,
    _normalize_qa_context,
    app,
    rate_limiter,
)


@pytest.fixture
def client(monkeypatch):
    """Create a signed-in test client for protected dashboard APIs."""
    monkeypatch.setattr(main, "ADMIN_USERNAME", "test-admin")
    monkeypatch.setattr(main, "ADMIN_PASSWORD", "test-password-long-enough")
    monkeypatch.setattr(main, "ADMIN_SESSION_SECRET", "test-session-secret-long-enough-123")
    main._admin_login_failures.clear()
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/auth/login",
            json={"username": "test-admin", "password": "test-password-long-enough"},
        )
        assert response.status_code == 200
        rate_limiter.requests.clear()
        yield test_client


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter before each test."""
    rate_limiter.requests.clear()
    main._admin_login_failures.clear()
    yield
    rate_limiter.requests.clear()
    main._admin_login_failures.clear()


def test_admin_dashboard_and_api_require_login(client):
    with TestClient(app) as anonymous:
        api_response = anonymous.get("/api/sites")
        dashboard_response = anonymous.get("/dashboard/", follow_redirects=False)
        status_response = anonymous.get("/api/auth/status")
        login_page = anonymous.get("/admin/login")
        health_response = anonymous.get("/api/health")
        welcome_response = anonymous.get("/api/sites/demo/welcome")

    assert api_response.status_code == 401
    assert dashboard_response.status_code == 303
    assert dashboard_response.headers["location"] == "/admin/login"
    assert login_page.status_code == 200
    assert "Sign in" in login_page.text
    assert health_response.status_code == 200
    assert status_response.json() == {
        "configured": True,
        "authenticated": False,
        "configuration_error": "",
    }
    assert welcome_response.status_code == 200


def test_admin_login_sets_http_only_cookie_and_serves_dashboard(monkeypatch):
    monkeypatch.setattr(main, "ADMIN_USERNAME", "test-admin")
    monkeypatch.setattr(main, "ADMIN_PASSWORD", "test-password-long-enough")
    monkeypatch.setattr(main, "ADMIN_SESSION_SECRET", "test-session-secret-long-enough-123")
    with TestClient(app) as signed_in:
        login = signed_in.post(
            "/api/auth/login",
            json={"username": "test-admin", "password": "test-password-long-enough"},
        )
        dashboard = signed_in.get("/dashboard/")

    cookie = login.headers["set-cookie"].lower()
    assert login.status_code == 200
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    assert "path=/" in cookie
    assert dashboard.status_code == 200
    assert "/dashboard/assets/" in dashboard.text


def test_admin_session_rejects_a_tampered_cookie(client):
    token = client.cookies.get(main.ADMIN_SESSION_COOKIE)
    assert token
    tampered_token = ("A" if token[0] != "A" else "B") + token[1:]
    with TestClient(app) as anonymous:
        anonymous.cookies.set(main.ADMIN_SESSION_COOKIE, tampered_token)
        response = anonymous.get("/api/sites")

    assert response.status_code == 401


def test_admin_login_rejects_bad_credentials_and_throttles(monkeypatch):
    monkeypatch.setattr(main, "ADMIN_USERNAME", "test-admin")
    monkeypatch.setattr(main, "ADMIN_PASSWORD", "test-password-long-enough")
    monkeypatch.setattr(main, "ADMIN_SESSION_SECRET", "test-session-secret-long-enough-123")
    with TestClient(app) as anonymous:
        for _ in range(main.ADMIN_LOGIN_MAX_ATTEMPTS):
            response = anonymous.post(
                "/api/auth/login",
                json={"username": "test-admin", "password": "wrong-password"},
            )
            assert response.status_code == 401
        throttled = anonymous.post(
            "/api/auth/login",
            json={"username": "test-admin", "password": "test-password-long-enough"},
        )

    assert throttled.status_code == 429


def test_admin_logout_revokes_session(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert client.get("/api/sites").status_code == 401


def test_admin_routes_fail_closed_without_credentials(monkeypatch):
    monkeypatch.setattr(main, "ADMIN_USERNAME", "")
    monkeypatch.setattr(main, "ADMIN_PASSWORD", "")
    monkeypatch.setattr(main, "ADMIN_SESSION_SECRET", "")
    with TestClient(app) as anonymous:
        api_response = anonymous.get("/api/sites")
        login_response = anonymous.post(
            "/api/auth/login",
            json={"username": "admin", "password": "password"},
        )

    assert api_response.status_code == 503
    assert login_response.status_code == 503


def test_live_config_exposes_actions_only_in_site_mode():
    qa_config = _build_live_config("qa", "Q&A instructions")
    site_config = _build_live_config("site", "Site instructions")

    assert qa_config.tools == []
    assert site_config.tools
    assert site_config.tools[0].function_declarations == TOOL_DECLARATIONS


def test_qa_context_is_bounded_without_rejecting_large_crawls():
    normalized = _normalize_qa_context("x" * (MAX_QA_CONTEXT_CHARS + 100))

    assert len(normalized) == MAX_QA_CONTEXT_CHARS


def test_qa_context_rejects_non_text_payloads():
    with pytest.raises(ValueError, match="must be text"):
        _normalize_qa_context({"unexpected": "object"})


def test_qa_question_includes_only_relevant_page_context():
    context = (
        "Website reference gathered from sitemap; 2 page(s) checked.\n"
        "### https://example.com/services/\n"
        "We provide web design, cloud services, and IT consulting.\n"
        "### https://example.com/\n"
        "13+ Years Experience in certification and compliance."
    )

    prompt = _build_qa_user_prompt("How much experience does BizGrow have?", context)

    assert "13+ Years Experience" in prompt
    assert "We provide web design" not in prompt
    assert "User question: How much experience does BizGrow have?" in prompt


def test_qa_question_includes_relevant_faq_late_on_the_current_page():
    question = "How is Bizgrow different from a regular compliance consultant?"
    context = (
        "Website reference gathered from current page; 1 page(s) checked.\n"
        "### https://example.com/\n"
        + ("Homepage introduction and unrelated content. " * 150)
        + "Frequently Asked Questions. "
        + question
        + " BizGrow provides practical support tailored to each company's compliance needs."
    )

    prompt = _build_qa_user_prompt(question, context)

    assert "BizGrow provides practical support tailored to each company's compliance needs." in prompt
    assert "Frequently Asked Questions" in prompt


def test_qa_question_without_context_is_sent_without_waiting():
    question = "How much experience does BizGrow have?"

    assert _build_qa_user_prompt(question, "") == question


# ========================================
# Health Check Endpoints
# ========================================


def test_health_check(client):
    """Test basic health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "webclaw-gateway"


@patch("main.check_health")
def test_api_health_check_connected(mock_check, client):
    """Test /api/health endpoint when Firestore is connected."""
    mock_check.return_value = True
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["firestore"] == "connected"


@patch("main.check_health")
def test_api_health_check_disconnected(mock_check, client):
    """Test /api/health endpoint when Firestore is disconnected."""
    mock_check.return_value = False
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["firestore"] == "disconnected"


@patch("main.check_health")
def test_api_health_check_error(mock_check, client):
    """Test /api/health endpoint when Firestore check raises error."""
    mock_check.side_effect = Exception("Connection failed")
    response = client.get("/api/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"


# ========================================
# Rate Limiting
# ========================================


def test_rate_limiter_allows_normal_requests(client):
    """Test that rate limiter allows normal request rates."""
    for i in range(10):
        response = client.get("/health")
        assert response.status_code == 200


def test_rate_limiter_blocks_excessive_requests(client):
    """Test that rate limiter blocks requests exceeding limit."""
    # Make 60 requests (the limit)
    for i in range(60):
        response = client.get("/health")
        assert response.status_code == 200

    # The 61st request should be blocked
    response = client.get("/health")
    assert response.status_code == 429
    data = response.json()
    assert "Rate limit exceeded" in data["error"]


# ========================================
# Site CRUD Operations
# ========================================


@patch("main.set_site_config")
@patch("main.record_event")
def test_create_site(mock_record, mock_set, client):
    """Test creating a new site."""
    payload = {
        "domain": "example.com",
        "persona_name": "Assistant",
        "persona_voice": "helpful",
        "welcome_message": "Welcome!",
        "knowledge_base": "Test knowledge",
    }
    response = client.post("/api/sites", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "site_id" in data
    assert data["config"]["domain"] == "example.com"
    assert mock_set.called
    assert mock_record.called


def test_create_site_invalid_domain_too_long(client):
    """Test creating a site with invalid domain (too long)."""
    payload = {
        "domain": "x" * 300,  # Exceeds 255 char limit
        "persona_name": "Assistant",
    }
    response = client.post("/api/sites", json=payload)
    assert response.status_code == 400


def test_create_site_invalid_email(client):
    """Test creating a site with invalid escalation email."""
    payload = {
        "domain": "example.com",
        "escalation_email": "not-an-email",
    }
    response = client.post("/api/sites", json=payload)
    assert response.status_code == 400


def test_create_site_invalid_max_actions(client):
    """Test creating a site with invalid max_actions_per_session."""
    payload = {
        "domain": "example.com",
        "max_actions_per_session": 5000,  # Exceeds 1000 limit
    }
    response = client.post("/api/sites", json=payload)
    assert response.status_code == 400


@patch("main.list_site_configs")
def test_list_sites(mock_list, client):
    """Test listing all sites."""
    from context.broker import SiteConfig

    mock_configs = [
        SiteConfig(site_id="demo", domain="localhost"),
        SiteConfig(site_id="test1", domain="example.com"),
    ]
    mock_list.return_value = mock_configs

    response = client.get("/api/sites")
    assert response.status_code == 200
    data = response.json()
    assert len(data["sites"]) == 2


@patch("main.list_site_configs")
def test_list_sites_respects_limit(mock_list, client):
    """Test that list sites respects limit parameter."""
    from context.broker import SiteConfig

    # Create 10 mock sites
    mock_configs = [
        SiteConfig(site_id=f"site{i}", domain=f"example{i}.com")
        for i in range(10)
    ]
    mock_list.return_value = mock_configs

    response = client.get("/api/sites?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["sites"]) == 5


@patch("main.list_site_configs")
def test_list_sites_enforces_max_limit(mock_list, client):
    """Test that list sites enforces max limit of 100."""
    from context.broker import SiteConfig

    mock_configs = [
        SiteConfig(site_id=f"site{i}", domain=f"example{i}.com")
        for i in range(150)
    ]
    mock_list.return_value = mock_configs

    response = client.get("/api/sites?limit=200")  # Request more than max
    assert response.status_code == 200
    data = response.json()
    assert len(data["sites"]) == 100  # Should be capped at 100


@patch("main.get_site_config")
def test_get_site_valid_id(mock_get, client):
    """Test getting a site with valid ID."""
    from context.broker import SiteConfig

    mock_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    response = client.get("/api/sites/demo")
    assert response.status_code == 200
    data = response.json()
    assert data["config"]["domain"] == "localhost"


def test_get_site_invalid_id_format(client):
    """Test getting a site with invalid ID format."""
    response = client.get("/api/sites/invalid@#$%")
    assert response.status_code == 400
    data = response.json()
    assert "Invalid site_id format" in data["error"]


@patch("main.get_site_config")
def test_get_site_not_found(mock_get, client):
    """Test getting a non-existent site."""
    mock_get.return_value = None
    response = client.get("/api/sites/nonexistent")
    assert response.status_code == 404


@patch("main.get_site_config")
@patch("main.set_site_config")
def test_update_site(mock_set, mock_get, client):
    """Test updating a site."""
    from context.broker import SiteConfig

    mock_get.return_value = SiteConfig(site_id="demo", domain="old.com")
    payload = {
        "domain": "new.com",
        "persona_name": "Updated",
    }
    response = client.put("/api/sites/demo", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["config"]["domain"] == "new.com"


def test_update_site_invalid_id(client):
    """Test updating a site with invalid ID."""
    payload = {"domain": "example.com"}
    response = client.put("/api/sites/invalid!@#", json=payload)
    assert response.status_code == 400


@patch("main.get_site_config")
@patch("main.delete_site_config")
def test_delete_site(mock_delete, mock_get, client):
    """Test deleting a site."""
    from context.broker import SiteConfig

    mock_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    response = client.delete("/api/sites/demo")
    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] is True


def test_delete_site_invalid_id(client):
    """Test deleting a site with invalid ID."""
    response = client.delete("/api/sites/invalid@")
    assert response.status_code == 400


# ========================================
# Knowledge Base Operations
# ========================================


@patch("main.get_site_config")
@patch("main.firestore_get_knowledge")
def test_list_knowledge(mock_fs_get, mock_site_get, client):
    """Test listing knowledge documents."""
    from context.broker import SiteConfig

    mock_site_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    mock_fs_get.return_value = [
        {"id": "doc1", "title": "FAQ", "content": "Common questions"},
        {"id": "doc2", "title": "Guide", "content": "User guide"},
    ]

    response = client.get("/api/sites/demo/knowledge")
    assert response.status_code == 200
    data = response.json()
    assert len(data["documents"]) == 2


@patch("main.get_site_config")
@patch("main.firestore_get_knowledge")
def test_list_knowledge_respects_limit(mock_fs_get, mock_site_get, client):
    """Test that list knowledge respects limit parameter."""
    from context.broker import SiteConfig

    mock_site_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    mock_fs_get.return_value = [
        {"id": f"doc{i}", "title": f"Title {i}", "content": "Content"}
        for i in range(50)
    ]

    response = client.get("/api/sites/demo/knowledge?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["documents"]) == 10


def test_list_knowledge_invalid_site_id(client):
    """Test listing knowledge with invalid site ID."""
    response = client.get("/api/sites/invalid!@/knowledge")
    assert response.status_code == 400


@patch("main.get_site_config")
@patch("main.firestore_set_knowledge")
def test_create_knowledge(mock_set, mock_site_get, client):
    """Test creating a knowledge document."""
    from context.broker import SiteConfig

    mock_site_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    payload = {
        "title": "FAQ",
        "content": "Frequently asked questions about our service",
    }
    response = client.post("/api/sites/demo/knowledge", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["title"] == "FAQ"


def test_create_knowledge_content_too_long(client):
    """Test creating knowledge document with content exceeding max length."""
    payload = {
        "title": "Test",
        "content": "x" * 60000,  # Exceeds 50000 limit
    }
    response = client.post("/api/sites/demo/knowledge", json=payload)
    assert response.status_code == 400


def test_create_knowledge_invalid_site_id(client):
    """Test creating knowledge document with invalid site ID."""
    payload = {
        "title": "Test",
        "content": "Test content",
    }
    response = client.post("/api/sites/invalid@/knowledge", json=payload)
    assert response.status_code == 400


@patch("main.firestore_set_knowledge")
def test_update_knowledge(mock_set, client):
    """Test updating a knowledge document."""
    payload = {
        "title": "Updated FAQ",
        "content": "Updated content",
    }
    response = client.put("/api/sites/demo/knowledge/doc1", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated FAQ"


def test_update_knowledge_invalid_ids(client):
    """Test updating knowledge with invalid IDs."""
    payload = {
        "title": "Test",
        "content": "Test",
    }
    response = client.put("/api/sites/invalid!/@#/knowledge/bad", json=payload)
    assert response.status_code == 400


@patch("main.firestore_delete_knowledge")
def test_delete_knowledge(mock_delete, client):
    """Test deleting a knowledge document."""
    response = client.delete("/api/sites/demo/knowledge/doc1")
    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] is True


def test_delete_knowledge_invalid_ids(client):
    """Test deleting knowledge with invalid IDs."""
    response = client.delete("/api/sites/invalid@/knowledge/bad#")
    assert response.status_code == 400


# ========================================
# Input Validation
# ========================================


def test_input_validation_string_length(client):
    """Test that long strings are rejected."""
    payload = {
        "domain": "x" * 1000,  # Way too long
        "persona_name": "Test",
    }
    response = client.post("/api/sites", json=payload)
    assert response.status_code == 400


def test_input_validation_knowledge_base_length(client):
    """Test that knowledge_base has max length."""
    payload = {
        "domain": "example.com",
        "knowledge_base": "x" * 6000,  # Exceeds 5000
    }
    response = client.post("/api/sites", json=payload)
    assert response.status_code == 400


# ========================================
# Session Operations
# ========================================


@patch("main.get_site_config")
@patch("main.list_sessions")
def test_list_sessions(mock_list, mock_site_get, client):
    """Test listing sessions for a site."""
    from context.broker import SiteConfig

    mock_site_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    mock_list.return_value = [
        {"id": "sess1", "user_id": "user1", "message_count": 5},
        {"id": "sess2", "user_id": "user2", "message_count": 3},
    ]

    response = client.get("/api/sites/demo/sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data["sessions"]) == 2


@patch("main.get_site_config")
@patch("main.list_sessions")
def test_list_sessions_respects_limit(mock_list, mock_site_get, client):
    """Test that list sessions respects limit parameter."""
    from context.broker import SiteConfig

    mock_site_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    mock_list.return_value = [
        {"id": f"sess{i}", "user_id": f"user{i}"}
        for i in range(30)
    ]

    response = client.get("/api/sites/demo/sessions?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["sessions"]) == 10


@patch("main.get_session_history")
def test_get_session(mock_get, client):
    """Test getting a specific session."""
    mock_get.return_value = {
        "id": "sess1",
        "messages": [
            {"role": "user", "text": "Hello"},
            {"role": "assistant", "text": "Hi there!"},
        ],
    }

    response = client.get("/api/sites/demo/sessions/sess1")
    assert response.status_code == 200
    data = response.json()
    assert len(data["session"]["messages"]) == 2


def test_get_session_invalid_ids(client):
    """Test getting session with invalid IDs."""
    response = client.get("/api/sites/invalid@/sessions/bad#")
    assert response.status_code == 400


@patch("main.get_site_config")
@patch("main.get_session_history")
def test_get_session_not_found(mock_get, mock_site_get, client):
    """Test getting a non-existent session."""
    from context.broker import SiteConfig

    mock_site_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    mock_get.return_value = None
    response = client.get("/api/sites/demo/sessions/nonexistent")
    assert response.status_code == 404


# ========================================
# Statistics/Analytics
# ========================================


@patch("main.get_site_config")
@patch("main.get_site_stats")
def test_get_site_stats(mock_stats, mock_site_get, client):
    """Test getting site statistics."""
    from context.broker import SiteConfig

    mock_site_get.return_value = SiteConfig(site_id="demo", domain="localhost")
    mock_stats.return_value = {
        "site_created": 1,
        "sessions_total": 10,
        "messages_text": 45,
        "actions_executed": 23,
    }

    response = client.get("/api/sites/demo/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["stats"]["sessions_total"] == 10


def test_get_stats_invalid_site_id(client):
    """Test getting stats with invalid site ID."""
    response = client.get("/api/sites/invalid!@#/stats")
    assert response.status_code == 400


# ========================================
# Error Handling
# ========================================


@patch("main.set_site_config")
def test_create_site_handles_errors(mock_set, client):
    """Test that error handling works for site creation."""
    mock_set.side_effect = Exception("Database error")
    payload = {
        "domain": "example.com",
        "persona_name": "Test",
    }
    response = client.post("/api/sites", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert "error" in data


@patch("main.list_site_configs")
def test_list_sites_handles_errors(mock_list, client):
    """Test that error handling works for list sites."""
    mock_list.side_effect = Exception("Database error")
    response = client.get("/api/sites")
    assert response.status_code == 500
    data = response.json()
    assert "error" in data


def test_error_response_includes_request_id(client):
    """Test that error responses include a request ID."""
    response = client.get("/api/sites/invalid@#$")
    data = response.json()
    # Either in error response or error_response
    assert "error" in data or "details" in data
