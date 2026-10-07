"""Tests for DOM agent tool input validation."""

import pytest

from agent.tools import check_checkbox, navigate_to, read_page, scroll_to


def test_read_page_includes_human_readable_content_request():
    result = read_page(selector="body", description="CEO details")

    assert result["selector"] == "body"
    assert result["description"] == "CEO details"
    assert result["status"] == "pending"


def test_scroll_to_includes_human_readable_target_description():
    result = scroll_to(
        selector="",
        direction="down",
        amount=300,
        description="Testimonials section",
    )

    assert result["description"] == "Testimonials section"
    assert result["status"] == "pending"


def test_check_checkbox_includes_exact_target_description():
    result = check_checkbox(
        selector="input:nth-of-type(2)",
        checked=True,
        description="SIA ACS",
    )

    assert result["description"] == "SIA ACS"
    assert result["status"] == "pending"


@pytest.mark.parametrize(
    "path",
    [
        "products.html",
        "../products.html",
        "/demo-site/products.html",
        "#products",
        "?category=audio",
        "https://example.com/products.html",
    ],
)
def test_navigate_to_accepts_http_urls_and_relative_paths(path):
    assert navigate_to(path)["url"] == path


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,unsafe",
        "//example.com/products.html",
        "ftp://example.com/products.html",
    ],
)
def test_navigate_to_rejects_unsafe_protocols_and_protocol_relative_urls(url):
    with pytest.raises(ValueError):
        navigate_to(url)
