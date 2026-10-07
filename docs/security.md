# Security & Privacy

WebClaw handles sensitive data: user voice, DOM content, personal preferences, and site knowledge bases. This document describes the threat model, trust boundaries, and security controls.

## Trust Model

WebClaw has three principals with different trust levels:

| Principal | Trusted With | Not Trusted With |
|:----------|:-------------|:-----------------|
| **Site Owner** | Their own knowledge base, action permissions, analytics | User personal data, browsing history, preferences |
| **User** | Their own data, microphone access, which sites to visit | Site owner's internal configurations, other users' data |
| **Gateway** | Brokering context, enforcing permissions | Long-term storage of user audio (stream-only) |

## Asymmetric Privacy Model

The core privacy guarantee: **site knowledge flows to the agent; user data never flows to the site.**

```
                    ┌──────────────────────┐
                    │   Agent's Context    │
                    │                      │
    Site KB ───────►│  Merged working set  │◄─────── User Prefs
    FAQs ──────────►│  (exists only in     │◄─────── History
    Docs ──────────►│   agent's session)   │         Personal data
    Actions ───────►│                      │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │   What the site      │
                    │   owner receives:    │
                    │                      │
                    │  • Anonymized query  │
                    │    analytics         │
                    │  • Task completion   │
                    │    rates             │
                    │  • Error logs        │
                    │                      │
                    │  NOT:                │
                    │  • User identity     │
                    │  • Personal data     │
                    │  • Browsing history  │
                    │  • Preferences       │
                    └──────────────────────┘
```

This is enforced architecturally, not by policy. The `build_agent_context()` function in the context broker physically constructs the merged prompt without exposing user data fields to the site config response path.

## Threat Model

### Threat 1: Malicious Site Owner

**Scenario:** A site owner configures a malicious system prompt to extract user data.

**Mitigation:** The site owner controls only their knowledge base, persona, and action permissions. They cannot modify the core system prompt that instructs the agent to protect user privacy. The agent's safety instructions are hardcoded in `prompts.py` and prepended before any site-specific content.

### Threat 2: DOM Injection Attacks

**Scenario:** A malicious page injects fake elements to trick the agent into clicking phishing links or submitting data to attacker-controlled endpoints.

**Mitigations:**
- The `allowed_actions` list restricts what the agent can do on the site
- `restricted_actions` explicitly blocks dangerous operations
- `max_actions_per_session` limits total actions (default: 100)
- The agent's system prompt includes rules: "Never submit payment forms or enter passwords without explicit user confirmation"
- Navigate actions are constrained to the current site's domain

### Threat 3: Audio Eavesdropping

**Scenario:** An attacker intercepts audio streams between the browser and gateway.

**Mitigations:**
- Production deployments use WSS (WebSocket Secure) over TLS
- Cloud Run enforces HTTPS by default
- Audio is streamed, not stored: no persistent audio recordings exist on the gateway
- The embed script requests microphone permission through the standard browser API, giving the user full control

### Threat 4: Cross-Site Data Leakage (Extension Mode)

**Scenario:** In Personal Agent mode, the extension carries user context across sites. A malicious site could attempt to extract this context.

**Mitigations:**
- User context is stored in `chrome.storage.local`, which is sandboxed per-extension
- The content script injects into pages but the injected overlay runs in a closed Shadow DOM
- WebSocket connections are per-session; no cross-site session sharing
- The gateway creates isolated ADK sessions per `(site_id, session_id)` pair

### Threat 5: Gateway Compromise

**Scenario:** An attacker gains access to the gateway server.

**Mitigations:**
- Cloud Run containers are stateless and ephemeral
- No persistent storage of audio or user data on the gateway (MVP uses in-memory sessions)
- API keys are stored in environment variables, not in code or config files
- Firestore (production) uses IAM-based access control

## Action Permission System

Every site configuration includes explicit action permissions:

```python
@dataclass
class SiteConfig:
    allowed_actions: list[str] = [
        "click", "type", "scroll", "scroll_to_top",
        "scroll_to_bottom", "navigate", "highlight",
        "read", "select", "check",
    ]
    restricted_actions: list[str] = []
    max_actions_per_session: int = 100
```

**Permission enforcement:**

| Level | Where Enforced | What It Does |
|:------|:---------------|:-------------|
| **Prompt-level** | Agent system prompt | Tells the model which actions are allowed/restricted |
| **Broker-level** | Context broker | Injects permissions into session context |
| **Client-level** | Embed script DOM actions executor | Validates action type before execution |

### Sensitive Action Safeguards

The agent's system prompt includes hardcoded safety rules that cannot be overridden by site configuration:

1. **Payment forms:** Never submit payment data without explicit user confirmation
2. **Personal data:** Always confirm before submitting forms with personal information
3. **Passwords:** Never enter passwords on behalf of the user
4. **Navigation boundaries:** Stay within the current website's domain

## Data Retention

| Data Type | Retention | Location |
|:----------|:----------|:---------|
| Audio streams | Not retained (streaming only) | Gateway memory (ephemeral) |
| Session state | Duration of WebSocket connection | In-memory (MVP) / Firestore (prod) |
| Site configurations | Persistent | In-memory (MVP) / Firestore (prod) |
| DOM snapshots | Duration of session | Agent context (not persisted) |
| User preferences | Per-extension install | `chrome.storage.local` |

## CORS Policy

The gateway allows all origins (`allow_origins=["*"]`) because the embed script runs on arbitrary third-party domains. This is the standard pattern for embeddable scripts (Google Analytics, Intercom, Segment all use the same approach).

The WebSocket upgrade request does not carry cookies or authentication tokens. Session identity is established through the URL path (`/ws/{site_id}/{session_id}`), not through headers.

## Recommendations for Production

1. **Enable WSS:** Cloud Run provides TLS termination by default. Ensure all embed script `data-gateway` URLs use `wss://`.

2. **API key rotation:** Rotate `GOOGLE_API_KEY` periodically. Use GCP Secret Manager for production deployments.

3. **Rate limiting:** Add per-IP rate limiting to the WebSocket endpoint to prevent abuse. Consider `slowapi` or Cloud Run's built-in concurrency limits.

4. **Site verification:** Before accepting a new site registration, verify domain ownership (DNS TXT record or meta tag, similar to Google Search Console).

5. **Audit logging:** Log all DOM actions executed by the agent with timestamps, session IDs, and action details for forensic analysis.

6. **Content Security Policy:** Site owners should add the gateway domain to their CSP `connect-src` directive to prevent mixed-content warnings.
