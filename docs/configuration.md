# Configuration Reference

Complete reference for all configurable aspects of WebClaw: site configurations, agent behavior, embed script attributes, extension settings, and infrastructure parameters.

## Site Configuration

Site configurations define how the WebClaw agent behaves on a specific website. Managed via the REST API (see [REST API Reference](api-rest.md)).

### Fields

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `site_id` | string | Auto-generated (8 chars) | Unique identifier for the site |
| `domain` | string | **(required)** | Website domain (e.g., `"yoursite.com"`) |
| `persona_name` | string | `"WebClaw"` | Agent's display name in greetings and UI |
| `persona_voice` | string | `"friendly and helpful"` | Natural language description of the agent's voice style |
| `welcome_message` | string | `"Hi! I'm here to help."` | First message spoken when a user opens the panel |
| `knowledge_base` | string | `""` | Freeform text: FAQs, product info, policies, documentation |
| `allowed_actions` | string[] | All 10 actions | DOM operations the agent may perform |
| `restricted_actions` | string[] | `[]` | DOM operations explicitly blocked (overrides allowed) |
| `escalation_email` | string | `""` | Email for human support handoff |
| `max_actions_per_session` | integer | `100` | Maximum DOM actions per WebSocket session |

### Available Actions

The `allowed_actions` and `restricted_actions` fields accept these values:

| Value | Operation |
|:------|:----------|
| `"click"` | Click elements (buttons, links, tabs) |
| `"type"` | Type text into inputs |
| `"scroll"` | Scroll to elements or by amount |
| `"scroll_to_top"` | Scroll to the very top of the page |
| `"scroll_to_bottom"` | Scroll to the very bottom of the page |
| `"navigate"` | Navigate to URLs |
| `"highlight"` | Highlight elements with visual effect |
| `"read"` | Extract text content |
| `"select"` | Choose dropdown options |
| `"check"` | Toggle checkboxes |

### Example Configurations

**Minimal (information-only site):**

```json
{
  "domain": "docs.example.com",
  "allowed_actions": ["read", "highlight", "scroll", "navigate"]
}
```

**E-commerce:**

```json
{
  "domain": "shop.example.com",
  "persona_name": "ShopBot",
  "persona_voice": "enthusiastic about products, concise, uses casual language",
  "welcome_message": "Hey there! Looking for something specific or just browsing?",
  "knowledge_base": "Products: ... Shipping: ... Returns: ...",
  "allowed_actions": ["click", "scroll", "navigate", "highlight", "read", "select"],
  "restricted_actions": ["type"],
  "max_actions_per_session": 50
}
```

**Full-access SaaS:**

```json
{
  "domain": "app.example.com",
  "persona_name": "AppAssist",
  "persona_voice": "professional, patient, explains step by step",
  "knowledge_base": "Feature docs, keyboard shortcuts, common workflows...",
  "allowed_actions": ["click", "type", "scroll", "navigate", "highlight", "read", "select", "check", "scroll_to_top", "scroll_to_bottom"],
  "max_actions_per_session": 200
}
```

## Embed Script Attributes

HTML `data-*` attributes on the `<script>` tag that control the embed's behavior.

| Attribute | Type | Default | Description |
|:----------|:-----|:--------|:------------|
| `data-site-id` | string | `"demo"` | Site identifier (from API registration) |
| `data-gateway` | string | `"http://localhost:8080"` | Gateway URL (use `wss://` in production) |
| `data-position` | string | `"bottom-right"` | Overlay position: `"bottom-right"` or `"bottom-left"` |
| `data-theme` | string | `"light"` | Color theme: `"light"` or `"dark"` |
| `data-color` | string | `"#FF4D4D"` | Primary accent color (hex) |

**Full example:**

```html
<script src="https://gateway.webclaw.dev/embed.js"
        data-site-id="a1b2c3d4"
        data-gateway="https://gateway.webclaw.dev"
        data-position="bottom-right"
        data-theme="dark"
        data-color="#e74c3c">
</script>
```

## Chrome Extension Settings

Stored in `chrome.storage.local`, configurable via the popup UI.

| Key | Type | Default | Description |
|:----|:-----|:--------|:------------|
| `gatewayUrl` | string | `"http://localhost:8081"` | Gateway URL to connect to |
| `autoActivate` | boolean | `false` | Auto-activate on every page load |
| `voiceMode` | boolean | `true` | Enable microphone and voice responses |
| `sendDomSnapshots` | boolean | `true` | Send page structure to agent for context |

## Agent System Prompt

The agent's core behavior is defined in `gateway/agent/prompts.py`. The system prompt has three layers:

### Layer 1: Core Identity (Hardcoded)

```
You are WebClaw, a personal live agent for website operations and support.
```

This layer defines the agent's identity, behavioral guidelines, capabilities, and safety rules. It cannot be overridden by site configuration.

### Layer 2: Site Persona (Dynamic)

```
On this site, your name is {persona_name}.
Voice style: {persona_voice}
When a user first connects, greet them with: "{welcome_message}"
```

Injected from the site configuration. Customizes the agent's personality per-site.

### Layer 3: Site Knowledge (Dynamic)

```
## Site Knowledge Base
{knowledge_base}

## Allowed Actions on This Site
You may perform: {allowed_actions}

## Restricted Actions
Do NOT perform: {restricted_actions}
```

Injected from the site configuration. Provides domain-specific knowledge and action boundaries.

### Safety Rules (Non-Overridable)

These rules are hardcoded and cannot be modified through configuration:

1. Never submit payment forms or enter passwords without explicit user confirmation
2. Always confirm before submitting forms with personal data
3. If you can't find an element, describe what you see and ask for guidance
4. Stay within the boundaries of the current website
5. Respect the site owner's configured action permissions

## ADK Agent Configuration

The agent is instantiated in `gateway/agent/agent.py`:

| Parameter | Value | Description |
|:----------|:------|:------------|
| `name` | `"webclaw_agent"` | Agent identifier in ADK |
| `model` | `"gemini-2.5-flash-native-audio-preview-12-2025"` | Must support `bidiGenerateContent` |
| `tools` | `DOM_TOOLS` (10 functions) | Available DOM actions |
| `instruction` | `WEBCLAW_SYSTEM_PROMPT` | Core system prompt |

### RunConfig (WebSocket Sessions)

| Parameter | Value | Description |
|:----------|:------|:------------|
| `streaming_mode` | `StreamingMode.BIDI` | Bidirectional streaming |
| `response_modalities` | `["AUDIO"]` | Agent responds with audio |
| `session_resumption` | Enabled | Allows session resume on reconnect |
| `input_audio_transcription` | Enabled (native audio models) | Transcribe user speech |
| `output_audio_transcription` | Enabled (native audio models) | Transcribe agent speech |

## Environment Variables

### Gateway (`gateway/.env`)

| Variable | Required | Description |
|:---------|:--------:|:------------|
| `GOOGLE_API_KEY` | ✅ | Gemini API key (from [AI Studio](https://aistudio.google.com/apikey)) |
| `GEMINI_API_KEY` | ⚠️ | Alternative to `GOOGLE_API_KEY`; if both set, `GOOGLE_API_KEY` takes priority |
| `GOOGLE_CLOUD_PROJECT` | | GCP project ID (auto-set on Cloud Run) |
| `PORT` | | Server port (default: `8080` on Cloud Run, `8081` local) |

### Terraform (`infra/terraform.tfvars`)

| Variable | Required | Default | Description |
|:---------|:--------:|:--------|:------------|
| `project_id` | ✅ | - | GCP project ID |
| `region` | | `"us-central1"` | GCP region for all resources |
| `gemini_api_key` | ✅ | - | Passed to Cloud Run as env var |

## Audio Configuration

Audio parameters are fixed to match Gemini Live API requirements:

| Parameter | Capture (Mic) | Playback (Agent) |
|:----------|:-------------|:-----------------|
| Sample rate | 16,000 Hz | 24,000 Hz |
| Bit depth | 16-bit signed | 16-bit signed |
| Channels | 1 (mono) | 1 (mono) |
| Encoding | PCM (raw) | PCM (base64 over WebSocket) |
| Buffer size | 4096 samples | Variable (per chunk) |

These values are not configurable; changing them would break compatibility with the Gemini Live API.

## DOM Snapshot Configuration

The DOM snapshot serializer has fixed parameters optimized for LLM context windows:

| Parameter | Value | Description |
|:----------|:------|:------------|
| Max depth | 3 levels | From `<body>` downward |
| Max characters | 4,000 | Total output cap |
| Included tags | Interactive + semantic | `button`, `a`, `input`, `select`, `h1`-`h6`, `nav`, `main`, etc. |
| Excluded tags | Non-semantic | `script`, `style`, `svg`, `noscript`, `iframe` |
| Hidden elements | Skipped | `display:none`, `visibility:hidden` |
