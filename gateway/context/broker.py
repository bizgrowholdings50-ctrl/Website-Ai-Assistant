"""WebClaw Context Broker: Manages knowledge base and permissions between site and agent.

Storage hierarchy:
  1. Firestore (production, when GOOGLE_CLOUD_PROJECT is set)
  2. In-memory dict (development fallback)

Both layers stay in sync: writes go to Firestore + memory, reads hit memory first.
"""

from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field

from storage.firestore import (
    firestore_get_knowledge,
    firestore_get_site,
    firestore_list_sites,
    firestore_set_site,
    firestore_delete_site as fs_delete_site,
    firestore_save_session,
    firestore_get_session,
    firestore_list_sessions,
    firestore_increment_stats,
    firestore_get_stats,
)

logger = logging.getLogger(__name__)


# ========================================
# Input Sanitization for Prompt Injection Prevention
# ========================================

def _sanitize_for_prompt(value: str, max_length: int = 5000) -> str:
    """Sanitize string for use in system prompt (prevent prompt injection).

    Does NOT strip legitimate content, but limits length and logs suspicious patterns.
    """
    if not isinstance(value, str):
        value = str(value)

    # Limit length
    value = value[:max_length]

    # Log suspicious patterns (but don't strip them - let the model decide)
    suspicious_patterns = [
        r'(?i)(ignore|forget|override|disregard).*instruction',
        r'(?i)system.*prompt',
        r'(?i)admin|superuser',
    ]
    for pattern in suspicious_patterns:
        if re.search(pattern, value):
            logger.warning(f"Suspicious pattern detected in prompt context: {pattern[:50]}")

    return value


@dataclass
class SiteConfig:
    """Configuration for a WebClaw-integrated website."""

    site_id: str
    domain: str
    persona_name: str = "WebClaw"
    persona_voice: str = "friendly and helpful"
    welcome_message: str = "Hi! I'm here to help. What can I do for you?"
    knowledge_base: str = ""
    allowed_actions: list[str] = field(default_factory=lambda: [
        "click", "type", "scroll", "navigate", "highlight", "read", "select", "check",
    ])
    restricted_actions: list[str] = field(default_factory=list)
    escalation_email: str = ""
    max_actions_per_session: int = 100


# In-memory cache (always present, syncs with Firestore)
_site_configs: dict[str, SiteConfig] = {}
_initialized = False

# Default demo config
_DEMO_CONFIG = SiteConfig(
    site_id="demo",
    domain="localhost",
    persona_name="BizGrow Holdings",
    welcome_message="Hey! I'm the BizGrow Holdings website assistant. Ask me anything or tell me what you need help with.",
    knowledge_base="This is a demo e-commerce site selling tech products. We offer free shipping on orders over $50. Returns accepted within 30 days.",
)


def _ensure_initialized() -> None:
    """Load configs from Firestore into memory on first access."""
    global _initialized
    if _initialized:
        return
    _initialized = True

    # Load from Firestore
    fs_sites = firestore_list_sites()
    for site_dict in fs_sites:
        sid = site_dict.get("site_id", "")
        if sid:
            try:
                cfg = SiteConfig(**{k: v for k, v in site_dict.items() if k in SiteConfig.__dataclass_fields__})
                _site_configs[sid] = cfg
            except Exception as e:
                logger.warning(f"Failed to load site {sid} from Firestore: {e}")

    # Ensure demo config exists
    if "demo" not in _site_configs:
        _site_configs["demo"] = _DEMO_CONFIG

    logger.info(f"Loaded {len(_site_configs)} site configs (Firestore + defaults)")


def get_site_config(site_id: str) -> SiteConfig | None:
    """Retrieve configuration for a site."""
    _ensure_initialized()
    return _site_configs.get(site_id)


def set_site_config(config: SiteConfig) -> None:
    """Store or update a site configuration (memory + Firestore)."""
    _ensure_initialized()
    try:
        # Validate knowledge_base length
        if len(config.knowledge_base) > 50000:
            raise ValueError("knowledge_base exceeds max length of 50000 chars")
        _site_configs[config.site_id] = config
        firestore_set_site(config.site_id, asdict(config))
        logger.info(f"Site config updated: {config.site_id} ({config.domain})")
    except Exception as e:
        logger.error(f"Error setting site config for {config.site_id}: {e}", exc_info=True)
        raise


def delete_site_config(site_id: str) -> bool:
    """Delete a site configuration."""
    _ensure_initialized()
    if site_id in _site_configs:
        del _site_configs[site_id]
    fs_delete_site(site_id)
    return True


def list_site_configs() -> list[SiteConfig]:
    """List all registered site configurations."""
    _ensure_initialized()
    return list(_site_configs.values())


def build_agent_context(site_id: str, user_context: dict | None = None) -> dict:
    """Build the context that gets injected into the agent for a session.

    This is the core of the context broker: it merges site knowledge with
    (optionally) user context from a Personal WebClaw, while enforcing
    asymmetric privacy (site knowledge flows to agent; user data stays private
    from the site).

    Args:
        site_id: The site identifier.
        user_context: Optional personal context from browser extension.

    Returns:
        dict with 'system_prompt_additions' and 'permissions'.
    """
    try:
        _ensure_initialized()
        config = get_site_config(site_id)
        if not config:
            return {
                "system_prompt_additions": "",
                "permissions": {"allowed_actions": ["read", "highlight", "scroll"]},
            }

        context: dict = {
            "system_prompt_additions": "",
            "permissions": {
                "allowed_actions": config.allowed_actions,
                "restricted_actions": config.restricted_actions,
                "max_actions": config.max_actions_per_session,
            },
        }

        parts = []

        # Site persona - sanitize to prevent prompt injection
        if config.persona_name and config.persona_name != "WebClaw":
            safe_name = _sanitize_for_prompt(config.persona_name, 200)
            parts.append(f"## Site Persona\nOn this site, your name is {safe_name}.")
        if config.persona_voice:
            safe_voice = _sanitize_for_prompt(config.persona_voice, 500)
            parts.append(f"Voice style: {safe_voice}")
        if config.welcome_message:
            safe_msg = _sanitize_for_prompt(config.welcome_message, 500)
            parts.append(f'When a user first connects, greet them with: "{safe_msg}"')

        # Site knowledge (inline config)
        if config.knowledge_base:
            safe_kb = _sanitize_for_prompt(config.knowledge_base, 50000)
            parts.append(f"## Site Knowledge\n{safe_kb}")

        # Firestore knowledge base documents (structured)
        fs_knowledge = firestore_get_knowledge(site_id)
        if fs_knowledge:
            kb_parts = []
            for doc in fs_knowledge:
                title = doc.get("title", doc.get("id", "Untitled"))
                content = doc.get("content", "")
                safe_title = _sanitize_for_prompt(title, 200)
                safe_content = _sanitize_for_prompt(content, 50000)
                kb_parts.append(f"### {safe_title}\n{safe_content}")
            parts.append("## Knowledge Base\n" + "\n\n".join(kb_parts))

        # Action permissions
        if config.allowed_actions:
            parts.append(f"## Allowed Actions\nYou may perform: {', '.join(config.allowed_actions)}")
        if config.restricted_actions:
            parts.append(f"## Restricted Actions\nDo NOT perform: {', '.join(config.restricted_actions)}")

        # Personal agent context (private, never shared with site analytics)
        if user_context:
            if user_context.get("preferences"):
                safe_prefs = _sanitize_for_prompt(user_context['preferences'], 5000)
                parts.append(f"## User Preferences (Private)\n{safe_prefs}")
            if user_context.get("history_summary"):
                safe_hist = _sanitize_for_prompt(user_context['history_summary'], 5000)
                parts.append(f"## Previous Interactions (Private)\n{safe_hist}")

        context["system_prompt_additions"] = "\n\n".join(parts)
        logger.info(f"Built agent context for site {site_id}")
        return context
    except Exception as e:
        logger.error(f"Error building agent context for {site_id}: {e}", exc_info=True)
        return {
            "system_prompt_additions": "",
            "permissions": {"allowed_actions": ["read", "highlight", "scroll"]},
        }


# ========================================
# Session & Analytics Proxies
# ========================================


def save_session_history(
    site_id: str,
    session_id: str,
    user_id: str,
    messages: list[dict],
    metadata: dict | None = None,
) -> None:
    """Save session conversation history to Firestore."""
    firestore_save_session(site_id, session_id, user_id, messages, metadata)


def get_session_history(site_id: str, session_id: str) -> dict | None:
    """Get session history from Firestore."""
    return firestore_get_session(site_id, session_id)


def list_sessions(site_id: str, limit: int = 50) -> list[dict]:
    """List recent sessions for a site."""
    return firestore_list_sessions(site_id, limit=limit)


def record_event(site_id: str, event: str) -> None:
    """Record an analytics event (lightweight counter)."""
    firestore_increment_stats(site_id, event)


def get_site_stats(site_id: str) -> dict:
    """Get analytics for a site."""
    return firestore_get_stats(site_id)
