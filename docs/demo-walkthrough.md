# Demo Walkthrough

This guide walks you through the TechByte demo e-commerce site included with WebClaw, showing what the agent can do and how to test each capability.

## Starting the Demo

### Prerequisites

1. Gateway running on port 8081 (see [Quick Start](quickstart.md))
2. Embed script built (`cd embed && npm run build`)

### Open the Demo

Navigate to [http://localhost:8081/demo/](http://localhost:8081/demo/) in your browser.

You will see the TechByte Store: a mock electronics shop with a home page, product catalog, product detail pages, a persistent cart, and a demo checkout. The FAQ and contact form are on the home page. In the bottom-right corner, the WebClaw avatar appears as an animated circle.

## The Demo Site

### Page Layout

The TechByte Store includes:

| Page/section | Content | WebClaw Interaction |
|:--------|:--------|:--------------------|
| **Header** | Store name, product links, cart counter | Agent can navigate between pages |
| **Home** | Welcome message, featured products, FAQ, contact form | Agent can answer questions and fill the form |
| **Catalog** | 6 product cards with detail links and "Add to cart" | Agent can compare products and add items |
| **Product detail** | Product description, features, price, add button | Agent can read specifications and add an item |
| **Cart** | Persistent items, quantity controls, shipping and totals | Agent can update quantities and remove items |
| **Checkout** | Demo delivery form and order summary | Agent can place a simulated order; no payment is collected |
| **FAQ** | 4 expandable accordion items | Agent can click to expand, read answers |
| **Contact** | Form with name, email, subject, message | Agent can fill fields, select subject |

### Product Catalog

| Product | Price | Category |
|:--------|:------|:---------|
| ProSound Wireless Headphones | $79.99 | Audio |
| MechKey Pro Keyboard | $129.99 | Input |
| SwiftClick Gaming Mouse | $49.99 | Input |
| PowerBank Ultra 20K | $39.99 | Power |
| ClearVoice USB Microphone | $89.99 | Audio |
| SmartGlow LED Strip 5m | $24.99 | Lighting |

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

**Type:** "Add the ProSound Wireless Headphones to my cart"

**Expected:** The agent clicks the headphones' "Add to cart" button. The cart counter updates and the item remains in the cart when navigating to another page.

### Test 5: Form Interaction

**Type:** "Fill in the contact form with my name John and email john@example.com"

**Expected:** The agent navigates to the contact section, types "John" in the name field, and "john@example.com" in the email field.

### Test 6: Element Highlight

**Type:** "Where is the search bar?" or "Show me the FAQ section"

**Expected:** The agent highlights the relevant element with a glow effect and optional tooltip.

### Test 7: Navigation

**Type:** "Open the product catalog and show me the keyboard"

**Expected:** The agent opens the catalog and can follow the MechKey Pro Keyboard link to its product detail page.

### Test 8: Multi-Step Task

**Type:** "Help me buy the SwiftClick Gaming Mouse"

**Expected:** The agent:
1. Opens the product catalog
2. Finds the SwiftClick Gaming Mouse and opens its details
3. Adds it to the cart
4. Opens the cart and confirms quantity and price

### Test 9: Cart and Checkout

1. Add products totaling less than $50 and open the cart.
2. Increase the quantity and confirm the subtotal and $5.99 standard shipping update.
3. Add enough items to exceed $50 and confirm standard shipping becomes free.
4. Continue to checkout, select Express, and place a demo order.

**Expected:** The order confirmation appears, the cart counter resets to zero, and no payment is collected.

### Test 10: FAQ Accordion

**Type:** "What is the return policy?"

**Expected:** The agent answers from the knowledge base or opens the FAQ on the home page to read the answer.

### Test 11: Voice Interaction

1. Click the **microphone icon** in the WebClaw overlay
2. Say: "What's the most expensive product you have?"
3. Listen for the agent's voice response

**Expected:** You hear the agent say something like "The most expensive product is the MechKey Pro Keyboard at $129.99."

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
[WebClaw] Executing action: click .btn-add
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
    "knowledge_base": "Premium electronics store. Products include ProSound Wireless Headphones ($79.99), MechKey Pro Keyboard ($129.99), SwiftClick Gaming Mouse ($49.99), PowerBank Ultra 20K ($39.99), ClearVoice USB Microphone ($89.99), and SmartGlow LED Strip 5m ($24.99). Free standard shipping on orders over $50, $5.99 below $50, and express shipping is $9.99. Returns accepted within 30 days.",
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
