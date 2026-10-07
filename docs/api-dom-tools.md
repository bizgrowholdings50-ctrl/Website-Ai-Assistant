# DOM Tools Reference

WebClaw's agent uses ten DOM action tools registered as Gemini function-calling functions. When the agent decides to take an action on the page, it returns a `functionCall` part in its response. The client (embed script or Chrome extension) executes the action and sends the result back.

## Tool Overview

| Tool | Purpose | Risk Level |
|:-----|:--------|:----------:|
| [`click_element`](#click_element) | Click buttons, links, tabs, menu items | 🟡 Medium |
| [`type_text`](#type_text) | Type into input fields and textareas | 🔴 High |
| [`scroll_to`](#scroll_to) | Scroll to elements or by pixel amount | 🟢 Low |
| [`scroll_to_top`](#scroll_to_top) | Scroll to the very top of the page | 🟢 Low |
| [`scroll_to_bottom`](#scroll_to_bottom) | Scroll to the very bottom of the page | 🟢 Low |
| [`navigate_to`](#navigate_to) | Navigate to URLs within the site | 🟡 Medium |
| [`highlight_element`](#highlight_element) | Draw visual attention to elements | 🟢 Low |
| [`read_page`](#read_page) | Extract text content from elements | 🟢 Low |
| [`select_option`](#select_option) | Choose from dropdowns and selects | 🟡 Medium |
| [`check_checkbox`](#check_checkbox) | Toggle checkboxes on or off | 🟡 Medium |

## Tool Definitions

### `click_element`

Click an element on the page.

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:--------:|:------------|
| `selector` | string | ✅ | CSS selector or ARIA label to identify the element |
| `description` | string | | Human-readable description of what is being clicked |

**Return value:**

```json
{
  "action": "click",
  "selector": ".add-to-cart",
  "description": "Adding product to cart",
  "status": "pending"
}
```

**Example agent invocation:**

```json
{
  "functionCall": {
    "name": "click_element",
    "args": {
      "selector": "#checkout-btn",
      "description": "Proceeding to checkout"
    }
  }
}
```

---

### `type_text`

Type text into an input field.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|:----------|:-----|:--------:|:--------|:------------|
| `selector` | string | ✅ | - | CSS selector or ARIA label of the input element |
| `text` | string | ✅ | - | The text to type into the field |
| `clear_first` | boolean | | `true` | Whether to clear existing content before typing |

**Return value:**

```json
{
  "action": "type",
  "selector": "#email-input",
  "text": "user@example.com",
  "clear_first": true,
  "status": "pending"
}
```

**Safety note:** The agent's system prompt requires explicit user confirmation before typing personal data.

---

### `scroll_to`

Scroll the page or scroll to a specific element.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|:----------|:-----|:--------:|:--------|:------------|
| `selector` | string | | `""` | CSS selector to scroll to. If empty, scrolls by amount. |
| `direction` | string | | `"down"` | `"up"` or `"down"`. Only used when selector is empty. |
| `amount` | integer | | `300` | Pixels to scroll. Only used when selector is empty. |

**Behavior:**
- If `selector` is provided: uses `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`
- If `selector` is empty: uses `window.scrollBy(0, amount)` (negative for up)

---

### `scroll_to_top`

Scroll the page to the very top.

**Parameters:** None

**Return value:**

```json
{
  "action": "scroll_to_top",
  "status": "pending"
}
```

**Example agent invocation:**

```json
{
  "functionCall": {
    "name": "scroll_to_top",
    "args": {}
  }
}
```

---

### `scroll_to_bottom`

Scroll the page to the very bottom.

**Parameters:** None

**Return value:**

```json
{
  "action": "scroll_to_bottom",
  "status": "pending"
}
```

**Example agent invocation:**

```json
{
  "functionCall": {
    "name": "scroll_to_bottom",
    "args": {}
  }
}
```

---

### `navigate_to`

Navigate to a URL within the current website.

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:--------:|:------------|
| `url` | string | ✅ | URL or path to navigate to (relative or absolute within the site) |

**Safety note:** Navigation is constrained to the current site's domain by the agent's system prompt. The client-side executor should also validate the URL before executing.

---

### `highlight_element`

Draw visual attention to an element with a glow border and optional tooltip.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|:----------|:-----|:--------:|:--------|:------------|
| `selector` | string | ✅ | - | CSS selector or ARIA label of the element to highlight |
| `message` | string | | `""` | Optional tooltip message to show near the element |

**Client-side behavior:**

The embed script applies a temporary visual effect:

```css
outline: 3px solid #FF4D4D;
outline-offset: 2px;
box-shadow: 0 0 15px rgba(66, 133, 244, 0.5);
transition: all 0.3s ease;
```

The highlight auto-removes after 3 seconds. If a `message` is provided, it appears as a tooltip above the element.

---

### `read_page`

Extract and return text content from the page or a specific element.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|:----------|:-----|:--------:|:--------|:------------|
| `selector` | string | | `"body"` | CSS selector of the element to read |

**Client-side behavior:**

Returns `element.textContent.trim()` for the matched element, truncated to a reasonable length for the agent's context window.

---

### `select_option`

Select an option from a dropdown or `<select>` element.

**Parameters:**

| Parameter | Type | Required | Description |
|:----------|:-----|:--------:|:------------|
| `selector` | string | ✅ | CSS selector of the select/dropdown element |
| `value` | string | ✅ | The `value` attribute or visible text of the option to select |

**Client-side behavior:**

Tries matching by `option.value` first, then by `option.textContent`. Dispatches a `change` event after selection to trigger form handlers.

---

### `check_checkbox`

Check or uncheck a checkbox element.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|:----------|:-----|:--------:|:--------|:------------|
| `selector` | string | ✅ | - | CSS selector of the checkbox element |
| `checked` | boolean | | `true` | Whether to check (`true`) or uncheck (`false`) |

**Client-side behavior:**

Sets `element.checked = checked` and dispatches both `click` and `change` events to trigger form handlers.

---

## Smart Element Finder

When the agent specifies a `selector`, the DOM action executor tries three strategies in order:

### Strategy 1: CSS Selector

```javascript
document.querySelector(selector)
```

Direct CSS selector match. Works when the agent has accurate selectors from the DOM snapshot.

### Strategy 2: ARIA Label

```javascript
document.querySelector(`[aria-label="${selector}"]`)
```

Falls back to ARIA label matching. Useful when the agent references elements by their accessible name (e.g., `"Add to Cart"` instead of `.btn-primary`).

### Strategy 3: Text Content Match

```javascript
// Search through interactive elements
const elements = document.querySelectorAll('button, a, [role="button"], label, input[type="submit"]');
for (const el of elements) {
  if (el.textContent.trim().toLowerCase().includes(selector.toLowerCase())) {
    return el;
  }
}
```

Fuzzy matching against the visible text of interactive elements. This is the most flexible strategy and handles natural language references like "the blue Add to Cart button."

### Fallback Behavior

If no element is found by any strategy, the action executor returns an error result:

```json
{
  "success": false,
  "error": "Element not found",
  "selector": "the green button",
  "strategies_tried": ["css", "aria", "text"]
}
```

The agent receives this feedback and can adjust its approach (e.g., ask the user for clarification, try a different selector, or request a fresh DOM snapshot).

## Action Result Format

After executing any action, the client sends the result back to the gateway:

**Success:**

```json
{
  "type": "dom_result",
  "result": {
    "success": true,
    "action": "click",
    "selector": ".add-to-cart",
    "message": "Element clicked successfully"
  }
}
```

**Failure:**

```json
{
  "type": "dom_result",
  "result": {
    "success": false,
    "action": "click",
    "selector": ".nonexistent",
    "error": "Element not found"
  }
}
```

The gateway forwards these results to Gemini as text context, allowing the agent to adapt its behavior based on action outcomes.

## Permission Enforcement

DOM actions are filtered at three levels:

| Level | Enforcement Point | Mechanism |
|:------|:-------------------|:----------|
| **Model level** | Agent system prompt | `allowed_actions` and `restricted_actions` injected into prompt |
| **Broker level** | Context broker | Permissions included in session context |
| **Client level** | Embed script / Extension | Action executor can validate before execution |

If the model calls a restricted tool despite prompt instructions, the client-side executor should reject it and return an error result.
