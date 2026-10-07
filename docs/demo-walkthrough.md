# Demo Walkthrough

This guide walks you through the TechByte demo e-commerce site included with WebClaw, showing what the agent can do and how to test each capability.

## Starting the Demo

### Prerequisites

1. Gateway running on port 8081 (see [Quick Start](quickstart.md))
2. Embed script built (`cd embed && npm run build`)

### Open the Demo

Navigate to [http://localhost:8081/demo/](http://localhost:8081/demo/) in your browser.

You will see the TechByte Store: a mock electronics shop with product cards, a FAQ section, and a contact form. In the bottom-right corner, the WebClaw avatar appears as an animated circle.

## The Demo Site

### Page Layout

The TechByte Store includes:

| Section | Content | WebClaw Interaction |
|:--------|:--------|:--------------------|
| **Header** | Store name, navigation links | Agent can click nav links |
| **Hero** | Welcome message, shop button | Agent can click "Shop Now" |
| **Products** | 6 product cards with "Add to Cart" | Agent can click products, read details |
| **FAQ** | 4 expandable accordion items | Agent can click to expand, read answers |
| **Contact** | Form with name, email, subject, message | Agent can fill fields, select subject |
| **Cart** | Floating cart counter | Updates when agent adds items |

### Product Catalog

| Product | Price | Category |
|:--------|:------|:---------|
| Wireless Headphones Pro | $89.99 | Audio |
| Smart Watch Ultra | $299.99 | Wearables |
| Portable Speaker Max | $149.99 | Audio |
| USB-C Hub 7-in-1 | $49.99 | Accessories |
| Mechanical Keyboard RGB | $129.99 | Input |
| Webcam 4K HDR | $79.99 | Video |

### Knowledge Base

The demo site is pre-configured with this knowledge base (from `context/broker.py`):

> "This is a demo e-commerce site selling tech products. We offer free shipping on orders over $50. Returns accepted within 30 days."

## Testing Interactions

### Test 1: Basic Q&A

**Type:** "What products do you sell?"

**Expected:** The agent reads the page content and lists the available products. If voice mode is active, you will hear the response as audio.

### Test 2: Knowledge Base Query

**Type:** "What's your return policy?"

**Expected:** "Returns accepted within 30 days." The agent answers from the pre-loaded knowledge base without needing to read the page.

### Test 3: Scroll Action

**Type:** "Scroll down to the FAQ section"

**Expected:** The page smoothly scrolls to the FAQ section. The agent confirms: "I've scrolled to the FAQ section."

### Test 4: Click Action

**Type:** "Click the first product's Add to Cart button"

**Expected:** The agent clicks the "Add to Cart" button on the Wireless Headphones Pro card. The cart counter updates.

### Test 5: Form Interaction

**Type:** "Fill in the contact form with my name John and email john@example.com"

**Expected:** The agent navigates to the contact section, types "John" in the name field, and "john@example.com" in the email field.

### Test 6: Element Highlight

**Type:** "Where is the search bar?" or "Show me the FAQ section"

**Expected:** The agent highlights the relevant element with a glow effect and optional tooltip.

### Test 7: Navigation

**Type:** "Go to the top of the page"

**Expected:** The agent scrolls to the top of the page.

### Test 8: Multi-Step Task

**Type:** "Help me buy the USB-C Hub"

**Expected:** The agent:
1. Scrolls to the products section
2. Finds the USB-C Hub card
3. Clicks "Add to Cart"
4. Confirms the action

### Test 9: FAQ Accordion

**Type:** "What are the shipping options?"

**Expected:** The agent either answers from the knowledge base or clicks the relevant FAQ accordion item to expand it and reads the answer.

### Test 10: Voice Interaction

1. Click the **microphone icon** in the WebClaw overlay
2. Say: "What's the most expensive product you have?"
3. Listen for the agent's voice response

**Expected:** You hear the agent say something like "The most expensive product is the Smart Watch Ultra at $299.99."

## Observing Agent Behavior

### Avatar States

Watch the avatar as you interact:

- **Idle:** Gentle breathing animation, occasional eye blinks
- **Listening:** Blue glow, eyes attentive (when mic is active)
- **Speaking:** Lip-sync animation, green glow (when audio plays)
- **Thinking:** Spinning arc around the head (processing your request)
- **Acting:** Lightning bolt indicator (executing a DOM action)

### Chat Panel

The chat panel shows:
- Your messages (right-aligned, colored)
- Agent responses (left-aligned, gray)
- Action notifications (centered, italic)

### Browser Console

Open DevTools (F12) → Console to see:

```
[WebClaw] Connected to gateway ws://localhost:8081/ws/demo/...
[WebClaw] Sent DOM snapshot (2341 chars)
[WebClaw] Received audio chunk (15360 bytes)
[WebClaw] Executing action: click #add-to-cart
[WebClaw] Action result: {success: true, element: "button"}
```

## Customizing the Demo

### Change the Knowledge Base

```bash
curl -X PUT http://localhost:8081/api/sites/demo \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "localhost",
    "persona_name": "TechBot",
    "persona_voice": "enthusiastic, tech-savvy, uses product names",
    "welcome_message": "Welcome to TechByte! I know everything about our products. Try me!",
    "knowledge_base": "Premium electronics store. Best sellers: Smart Watch Ultra ($299.99) and Wireless Headphones Pro ($89.99). We price-match Amazon. Student discount: 15% off with .edu email. Free express shipping on orders over $100.",
    "allowed_actions": ["click", "type", "scroll", "scroll_to_top", "scroll_to_bottom", "navigate", "highlight", "read", "select", "check"]
  }'
```

### Restrict Actions

Make the agent read-only (information only, no clicking):

```bash
curl -X PUT http://localhost:8081/api/sites/demo \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "localhost",
    "persona_name": "Claw",
    "knowledge_base": "Demo e-commerce site. Free shipping over $50. 30-day returns.",
    "allowed_actions": ["read", "highlight", "scroll"],
    "restricted_actions": ["click", "type", "navigate", "select", "check"]
  }'
```

Now try "Add the headphones to my cart" and the agent will explain it cannot take that action.

## Next Steps

- [**Site Owner Guide**](site-owner-guide.md): Register your own site
- [**DOM Tools Reference**](api-dom-tools.md): All available agent actions
- [**WebSocket Protocol**](api-websocket.md): Understanding the streaming data
