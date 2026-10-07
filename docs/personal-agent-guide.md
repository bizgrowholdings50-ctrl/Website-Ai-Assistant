# Personal Agent Guide

The WebClaw Chrome Extension turns your browser into a personal AI-powered workspace. Unlike the Site Agent (which serves website visitors), the Personal Agent serves **you** and works on any website, whether it has WebClaw integrated or not.

## Installation

### From Source (Development)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` directory from the WebClaw project
5. The WebClaw icon appears in your toolbar

### Permissions Requested

| Permission | Why It's Needed |
|:-----------|:----------------|
| `activeTab` | Access the current page's DOM to read content and execute actions |
| `storage` | Persist your settings (gateway URL, preferences) across sessions |
| `scripting` | Inject the WebClaw overlay and action executor into pages |

The extension does **not** request `<all_urls>`, `history`, `bookmarks`, or any other broad permissions.

## Configuration

Click the WebClaw toolbar icon to open the settings popup:

| Setting | Default | Description |
|:--------|:--------|:------------|
| **Gateway URL** | `http://localhost:8081` | The WebClaw Gateway to connect to |
| **Auto-activate** | Off | Automatically activate WebClaw on every page |
| **Voice mode** | On | Enable voice interaction (microphone) |
| **Send DOM snapshots** | On | Send page structure to the agent for context |

### Gateway URL

Point this to your running gateway:

- **Local development:** `http://localhost:8081`
- **Production (self-hosted):** `https://webclaw-gateway-HASH.a.run.app`

## How It Works

### Activation

**Manual activation (default):** Click the WebClaw toolbar icon on any page, then click "Activate" in the popup. The overlay appears in the bottom-right corner.

**Auto-activation:** Enable "Auto-activate" in settings. The overlay will appear on every page you visit.

### What Happens When You Activate

```
1. Content script injects into the current page
2. Creates a closed Shadow DOM overlay (bottom-right)
3. Opens WebSocket to your configured gateway
4. Captures a simplified DOM snapshot (interactive elements only)
5. Sends snapshot to gateway for agent context
6. Agent is ready: speak or type
```

### Voice Interaction

The extension provides **persistent microphone access**. Unlike the embed script (which requires permission per-site), the extension requests microphone permission once during installation. This enables:

- **Always-on listening** (when voice mode is enabled)
- **No permission popups** on new sites
- **Faster activation** since the audio pipeline is pre-initialized

### DOM Snapshot

When "Send DOM snapshots" is enabled, the extension captures a simplified view of the current page:

- Interactive elements (buttons, links, inputs, selects)
- Semantic structure (headings, navigation, main content)
- ARIA labels and roles
- Form field states (values, placeholders, checked states)

This snapshot is sent to the gateway so the agent understands what is on the page. The snapshot is:

- **Token-efficient:** pruned to fit LLM context windows
- **Privacy-respecting:** does not capture passwords, hidden fields, or sensitive form data
- **Ephemeral:** exists only for the duration of the session

## Using the Personal Agent

### On Any Website

The Personal Agent works everywhere. It uses the DOM snapshot and Gemini's understanding to navigate and operate pages it has never seen before.

**Try these on any website:**

| Command | What Happens |
|:--------|:-------------|
| "What is this page about?" | Agent reads the page content and summarizes |
| "Find the pricing section" | Agent scrolls to pricing or highlights it |
| "Click the sign-up button" | Agent locates and clicks the button |
| "Fill in my email" | Agent finds the email field and types (if allowed) |
| "Read me the first paragraph" | Agent extracts and speaks the text |
| "Go to the about page" | Agent finds and clicks the About link |

### On WebClaw-Integrated Sites

When you visit a site that has WebClaw's embed script installed, the Personal Agent gains additional context:

- **Site knowledge base**: accurate answers to site-specific questions
- **Configured permissions**: the agent knows what it is and isn't allowed to do
- **Brand persona**: responses match the site's voice and style

This happens through the **Agent Negotiation Protocol**. On connection, the extension sends a `negotiate` message declaring its capabilities (screenshot capture, action execution, mic access, cross-site context). The gateway responds with a `negotiate_ack` containing the site's permissions and persona. The agent merges both contexts while keeping user data private.

The Personal Agent's private context (your preferences, history) is **never shared** with the site. See [Security & Privacy](security.md) for details.

## Architecture

The extension consists of four files:

### `manifest.json`

Manifest V3 declaration with minimal permissions:

```json
{
  "manifest_version": 3,
  "name": "WebClaw - Personal Live Agent",
  "permissions": ["activeTab", "storage", "scripting"],
  "action": { "default_popup": "popup.html" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "background": { "service_worker": "background.js" }
}
```

### `content.js` (313 lines)

The main content script injected into pages. Responsibilities:

| Function | Description |
|:---------|:------------|
| Overlay creation | Shadow DOM with chat panel, mic toggle, message input |
| WebSocket management | Connect to gateway, handle reconnection |
| DOM action execution | Execute click, type, scroll, navigate, highlight actions |
| Audio capture | Microphone via Web Audio API (16kHz PCM) |
| Audio playback | Decode and play gateway audio responses (24kHz PCM) |
| DOM snapshot | Capture interactive elements for agent context |

### `popup.html` / `popup.js`

Settings UI rendered when the toolbar icon is clicked. Reads/writes to `chrome.storage.local`.

### `background.js`

Service worker for extension lifecycle. Currently minimal; will handle:

- Extension install/update events
- Badge state management
- Cross-tab coordination (planned)

## Comparison: Extension vs Embed

| Feature | Chrome Extension | Embed Script |
|:--------|:----------------|:-------------|
| Works on any website | ✅ | Only integrated sites |
| Persistent mic permission | ✅ | Per-site browser prompt |
| Cross-site context | ✅ | Per-session only |
| User installation required | ✅ | None (invisible to user) |
| Site knowledge base access | When available | ✅ Always |
| Site owner analytics | ❌ | ✅ |
| Style isolation | Shadow DOM | Shadow DOM |
| Bundle size | ~30KB (unminified) | 26.1KB (minified) |

## Privacy

The extension stores only:

| Data | Storage | Scope |
|:-----|:--------|:------|
| Gateway URL | `chrome.storage.local` | Per-extension |
| Settings (auto-activate, voice, snapshots) | `chrome.storage.local` | Per-extension |
| Session state | Gateway memory | Per WebSocket connection |

The extension does **not** store:

- Browsing history
- Page content or screenshots
- Audio recordings
- Form data or passwords
- Cookies or authentication tokens

## Troubleshooting

| Problem | Solution |
|:--------|:---------|
| Overlay doesn't appear | Check that the extension is enabled in `chrome://extensions` |
| "Connection failed" | Verify the Gateway URL in settings; check that the gateway is running |
| No audio response | Check that voice mode is enabled; verify `GOOGLE_API_KEY` in gateway |
| Microphone not working | Check Chrome's site permissions; try `chrome://settings/content/microphone` |
| Actions not working on a site | Some sites use frameworks that prevent programmatic clicks; try highlighting instead |
| Extension conflicts | Disable other extensions temporarily to isolate the issue |
