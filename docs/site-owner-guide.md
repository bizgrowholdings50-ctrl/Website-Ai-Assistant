# Site Owner Guide

This guide covers everything a website owner needs to integrate WebClaw: registration, configuration, customization, knowledge base setup, and monitoring.

## Integration Overview

Adding WebClaw to your website takes three steps:

1. Register your site with the gateway API
2. Add a `<script>` tag to your HTML
3. Configure knowledge base and permissions

Total integration time: under 5 minutes.

## Step 1: Register Your Site

Create a site configuration by calling the gateway API:

```bash
curl -X POST https://your-gateway.run.app/api/sites \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "yourstore.com",
    "persona_name": "Aria",
    "persona_voice": "warm, professional, concise",
    "welcome_message": "Hi! I'\''m Aria, your shopping assistant. How can I help?",
    "knowledge_base": "We sell organic coffee. Free shipping over $30. 14-day return policy. Based in Portland, OR.",
    "allowed_actions": ["click", "scroll", "navigate", "highlight", "read", "select"],
    "restricted_actions": ["type"],
    "escalation_email": "support@yourstore.com"
  }'
```

Response:

```json
{
  "site_id": "a1b2c3d4",
  "config": {
    "site_id": "a1b2c3d4",
    "domain": "yourstore.com",
    "persona_name": "Aria",
    ...
  }
}
```

Save the `site_id` value. You will need it for the script tag.

## Step 2: Add the Script Tag

Add this to the bottom of your HTML, just before `</body>`:

```html
<script src="https://your-gateway.run.app/embed.js"
        data-site-id="a1b2c3d4"
        data-gateway="https://your-gateway.run.app"
        data-position="bottom-right"
        data-color="#your-brand-color">
</script>
```

That is it. WebClaw will appear on your site for all visitors.

## Configuration Reference

### Script Tag Attributes

| Attribute | Required | Default | Description |
|:----------|:--------:|:--------|:------------|
| `data-site-id` | ✅ | `"demo"` | Your registered site identifier |
| `data-gateway` | ✅ | `"http://localhost:8080"` | Gateway URL (use `https://` in production) |
| `data-position` | | `"bottom-right"` | Overlay position: `bottom-right` or `bottom-left` |
| `data-theme` | | `"light"` | Color theme: `light` or `dark` |
| `data-color` | | `"#FF4D4D"` | Primary accent color for avatar glow, buttons, highlights. See [Branding](branding.md) for the full palette |

### Site Configuration Fields

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `domain` | string | (required) | Your website's domain (for validation) |
| `persona_name` | string | `"WebClaw"` | The agent's display name |
| `persona_voice` | string | `"friendly and helpful"` | Voice style guidance for the model |
| `welcome_message` | string | `"Hi! I'm here to help."` | First message when user connects |
| `knowledge_base` | string | `""` | Site-specific knowledge (see below) |
| `allowed_actions` | string[] | all 10 actions | DOM actions the agent may perform |
| `restricted_actions` | string[] | `[]` | DOM actions explicitly blocked |
| `escalation_email` | string | `""` | Email for human handoff |
| `max_actions_per_session` | int | `100` | Rate limit for DOM actions per session |

## Knowledge Base

The knowledge base is the most important configuration. It determines what the agent knows about your site and how accurately it can answer questions.

### Writing an Effective Knowledge Base

**Structure it clearly:**

```
We are CoffeeHub, an online specialty coffee retailer.

Products:
- Single Origin Ethiopian Yirgacheffe ($18/bag)
- Colombian Supremo Blend ($15/bag)
- Cold Brew Concentrate ($22/bottle)
- Subscription Box ($45/month, 3 bags)

Shipping:
- Free shipping on orders over $30
- Standard shipping: 3-5 business days ($5.99)
- Express shipping: 1-2 business days ($12.99)
- We ship to all 50 US states. No international shipping.

Returns:
- 14-day return policy on unopened items
- No returns on subscription orders
- Contact support@coffeehub.com for returns

FAQ:
- Beans are roasted within 48 hours of order
- All coffee is Fair Trade certified
- Grinding options: whole bean, drip, espresso, French press
```

**Best practices:**

| Do | Don't |
|:---|:------|
| Use clear categories and bullet points | Write long prose paragraphs |
| Include specific numbers (prices, days, limits) | Use vague language ("affordable", "fast") |
| Cover the top 10 questions customers ask | Include internal processes or employee info |
| Update when products/policies change | Set it once and forget it |
| Be honest about limitations ("no international shipping") | Omit restrictions hoping users won't ask |

### Updating the Knowledge Base

```bash
curl -X PUT https://your-gateway.run.app/api/sites/a1b2c3d4 \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "yourstore.com",
    "persona_name": "Aria",
    "knowledge_base": "Updated knowledge base content here...",
    "allowed_actions": ["click", "scroll", "navigate", "highlight", "read"]
  }'
```

## Action Permissions

Control what the agent can do on your site. The ten available actions:

| Action | What It Does | Risk Level | Recommended |
|:-------|:-------------|:----------:|:-----------:|
| `read` | Extract text from elements | 🟢 Low | ✅ Always allow |
| `highlight` | Draw attention to elements | 🟢 Low | ✅ Always allow |
| `scroll` | Scroll to elements or by amount | 🟢 Low | ✅ Always allow |
| `scroll_to_top` | Scroll to the very top of the page | 🟢 Low | ✅ Always allow |
| `scroll_to_bottom` | Scroll to the very bottom of the page | 🟢 Low | ✅ Always allow |
| `navigate` | Navigate to URLs within site | 🟡 Medium | ✅ Usually allow |
| `click` | Click buttons, links, tabs | 🟡 Medium | ✅ Usually allow |
| `select` | Choose dropdown options | 🟡 Medium | Case-by-case |
| `check` | Toggle checkboxes | 🟡 Medium | Case-by-case |
| `type` | Type into input fields | 🔴 High | ⚠️ Consider restricting |

**Recommended permission sets by site type:**

| Site Type | Suggested `allowed_actions` | Restricted |
|:----------|:----------------------------|:-----------|
| Informational / Blog | `read`, `highlight`, `scroll`, `navigate` | `type`, `click`, `select`, `check` |
| E-commerce | `read`, `highlight`, `scroll`, `navigate`, `click`, `select` | `type` |
| SaaS / Web App | All | None (but set `max_actions_per_session`) |
| Form-heavy | All | None (agent confirms before submitting) |

## Persona Customization

### Voice Style

The `persona_voice` field guides the model's tone. Examples:

| Industry | Suggested Voice |
|:---------|:----------------|
| E-commerce | `"friendly, enthusiastic about products, concise"` |
| Legal / Finance | `"professional, precise, measured"` |
| Healthcare | `"empathetic, patient, clear, avoids medical advice"` |
| Gaming / Entertainment | `"casual, fun, uses gaming terminology"` |
| Education | `"encouraging, explains concepts step by step"` |

### Welcome Message

The welcome message fires when a user first opens the WebClaw panel. Make it specific:

```json
{
  "welcome_message": "Hey! I'm Aria from CoffeeHub. I can help you find the perfect coffee, check order status, or answer questions about our roasting process. What sounds good?"
}
```

## Managing Your Site

### View Current Configuration

```bash
curl https://your-gateway.run.app/api/sites/a1b2c3d4
```

### List All Sites

```bash
curl https://your-gateway.run.app/api/sites
```

### Delete a Site

```bash
curl -X DELETE https://your-gateway.run.app/api/sites/a1b2c3d4
```

### Using the Dashboard

The gateway includes a built-in dashboard at `/dashboard`. Open your browser to:

```
https://your-gateway.run.app/dashboard
```

The dashboard provides a visual interface for all management tasks:

- **Overview**: Stats (sessions, messages, actions), site list, embed snippet generator
- **Sites**: Create, edit, and delete site configurations
- **Knowledge Base**: Add, edit, and delete structured knowledge documents per site
- **Sessions**: Browse conversation history with full message transcripts
- **Settings**: Gateway connection info and version

The dashboard connects to the same REST API documented in [API Reference](api-rest.md). Everything you can do from the CLI, you can do from the dashboard.

### Structured Knowledge Base (Firestore)

In addition to the `knowledge_base` text field on site config, you can store structured knowledge documents via the API or dashboard. These are stored in Firestore and automatically merged into the agent's context:

```bash
# Add a knowledge document
curl -X POST https://your-gateway.run.app/api/sites/a1b2c3d4/knowledge \
  -H "Content-Type: application/json" \
  -d '{"title": "Shipping Policy", "content": "Free shipping over $30. Standard: 3-5 days ($5.99). Express: 1-2 days ($12.99)."}'

# List all knowledge documents
curl https://your-gateway.run.app/api/sites/a1b2c3d4/knowledge

# Update a document
curl -X PUT https://your-gateway.run.app/api/sites/a1b2c3d4/knowledge/doc_id \
  -H "Content-Type: application/json" \
  -d '{"title": "Shipping Policy", "content": "Updated content..."}'

# Delete a document
curl -X DELETE https://your-gateway.run.app/api/sites/a1b2c3d4/knowledge/doc_id
```

## Monitoring

### Session History

View conversation transcripts for any site:

```bash
# List recent sessions
curl https://your-gateway.run.app/api/sites/a1b2c3d4/sessions?limit=20

# View a specific session's messages
curl https://your-gateway.run.app/api/sites/a1b2c3d4/sessions/session_id
```

Sessions are saved to Firestore when the WebSocket disconnects. Each session record includes messages (role, type, text, timestamp), duration, and message count.

### Analytics

```bash
curl https://your-gateway.run.app/api/sites/a1b2c3d4/stats
```

Returns counters for: `sessions_total`, `messages_text`, `actions_executed`, `audio_frames`, `screenshots`, `negotiations`.

### What the Agent Logs

The gateway logs every WebSocket connection with:

- Connection timestamp
- Site ID and session ID
- Disconnection reason
- Errors (if any)

Example log output:

```
2026-03-06 15:30:11 - webclaw.gateway - INFO - WebSocket connect: site=demo session=test456
2026-03-06 15:30:12 - google_adk... - INFO - Trying to connect to live model: gemini-2.5-flash-native-audio-preview-12-2025
2026-03-06 15:31:05 - webclaw.gateway - INFO - Session ended: test456
```

### Metrics to Watch

| Metric | Where | What It Tells You |
|:-------|:------|:------------------|
| WebSocket connections/min | Cloud Run metrics | Traffic volume |
| Session duration | Gateway logs | Engagement depth |
| Error rate | Cloud Run logs | Agent reliability |
| DOM actions/session | Gateway logs (planned) | Agent utility |
| Knowledge base hit rate | Agent transcripts (planned) | KB completeness |
