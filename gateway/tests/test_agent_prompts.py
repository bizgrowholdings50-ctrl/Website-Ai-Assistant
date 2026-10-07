"""Tests for site-specific agent prompts."""

from unittest.mock import patch

from agent.prompts import WEBCLAW_SYSTEM_PROMPT, build_qa_prompt, build_site_prompt
from context.broker import SiteConfig, build_agent_context


def test_site_prompt_does_not_repeat_configured_welcome_message():
    prompt = build_site_prompt({
        "welcome_message": "Welcome to the store!",
    })

    assert "Welcome to the store!" not in prompt
    assert "Do not repeat the greeting" in prompt


def test_agent_context_does_not_add_configured_welcome_message():
    welcome_message = "Welcome to the store!"
    config = SiteConfig(
        site_id="demo",
        domain="localhost",
        welcome_message=welcome_message,
    )

    with (
        patch("context.broker._ensure_initialized"),
        patch("context.broker.get_site_config", return_value=config),
        patch("context.broker.firestore_get_knowledge", return_value=[]),
    ):
        additions = build_agent_context("demo")["system_prompt_additions"]

    assert welcome_message not in additions


def test_qa_agent_context_includes_knowledge_without_action_permissions():
    config = SiteConfig(
        site_id="demo",
        domain="localhost",
        knowledge_base="Shipping is free over $50.",
    )

    with (
        patch("context.broker._ensure_initialized"),
        patch("context.broker.get_site_config", return_value=config),
        patch("context.broker.firestore_get_knowledge", return_value=[]),
    ):
        additions = build_agent_context(
            "demo",
            include_action_permissions=False,
        )["system_prompt_additions"]

    assert "Shipping is free over $50." in additions
    assert "Allowed Actions" not in additions
    assert "You may perform" not in additions


def test_agent_prompt_requires_exact_targets_and_verified_actions():
    assert "If the target is not unique, ask instead of guessing" in WEBCLAW_SYSTEM_PROMPT
    assert "A click being dispatched does not prove" in WEBCLAW_SYSTEM_PROMPT
    assert "A visible question list does not mean the answers are expanded" in WEBCLAW_SYSTEM_PROMPT
    assert "missing `aria-expanded`/disclosure metadata does not mean the FAQ is static or already open" in WEBCLAW_SYSTEM_PROMPT
    assert "visibility/open state cannot be confirmed, say so plainly" in WEBCLAW_SYSTEM_PROMPT


def test_qa_prompt_is_site_aware_but_disallows_website_actions():
    prompt = build_qa_prompt({
        "persona_name": "Demo Assistant",
        "persona_voice": "Friendly",
        "knowledge_base": "Free shipping over $50.",
    })

    assert "Demo Assistant" in prompt
    assert "Free shipping over $50." in prompt
    assert "Voice style: Friendly" in prompt
    assert "you cannot inspect or interact with the live page" in prompt
    assert "Do not click, navigate, scroll" in prompt
    assert "only with information explicitly supported by the configured site knowledge" in prompt
    assert "Do not infer, embellish, or fill missing details" in prompt
    assert "Answer the exact question asked" in prompt
    assert "If the source gives a related but narrower claim" in prompt
    assert "'13+ years of certification success'" in prompt
    assert "Only say the duration is unspecified if no relevant duration appears in either source" in prompt
    assert "Authoritative Site Knowledge Base" in prompt


def test_qa_prompt_does_not_use_general_knowledge_when_site_knowledge_is_missing():
    prompt = build_qa_prompt({"persona_name": "Demo Assistant"})

    assert "No configured site knowledge is available" in prompt
    assert "do not answer business-specific factual questions from general knowledge" in prompt
