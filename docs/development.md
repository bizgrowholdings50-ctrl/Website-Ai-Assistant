# Local Development

This guide covers setting up a complete WebClaw development environment: gateway backend, embed script with hot reload, Chrome extension debugging, and end-to-end testing.

## Prerequisites

| Tool | Version | Check |
|:-----|:--------|:------|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Chrome | Latest | For extension testing |
| Git | Any | `git --version` |

## Repository Setup

```bash
git clone https://github.com/AfrexAI/webclaw.git
cd webclaw
```

## Gateway Development

### Environment Setup

```bash
cd gateway

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: add GOOGLE_API_KEY
```

### Dependencies

The gateway's core dependencies:

| Package | Version | Purpose |
|:--------|:--------|:--------|
| `google-adk` | ≥0.5.0 | Agent Development Kit |
| `google-genai` | ≥1.0.0 | Google GenAI SDK |
| `fastapi` | ≥0.115.0 | Async web framework |
| `uvicorn` | ≥0.32.0 | ASGI server |
| `python-dotenv` | ≥1.0.0 | Environment variable loading |

### Running the Gateway

**Standard mode:**

```bash
uvicorn main:app --host 127.0.0.1 --port 8081
```

**Development mode (auto-reload):**

```bash
uvicorn main:app --host 127.0.0.1 --port 8081 --reload
```

Auto-reload watches for file changes in the gateway directory and restarts the server. Note that active WebSocket connections will be dropped on reload.

### Gateway Module Map

```
gateway/
├── main.py              # FastAPI app, WebSocket handler, REST endpoints
├── agent/
│   ├── __init__.py
│   ├── agent.py         # ADK Agent definition (model, tools, prompt)
│   ├── prompts.py       # System prompt + site-specific prompt builder
│   └── tools.py         # 10 DOM action tool functions
├── context/
│   ├── __init__.py
│   └── broker.py        # Site config store + context merger
├── voice/               # Reserved for voice pipeline enhancements
│   └── __init__.py
├── requirements.txt
├── Dockerfile
├── .env.example
└── .env                 # Your local config (git-ignored)
```

### Testing the Gateway

**Health check:**

```bash
curl http://127.0.0.1:8081/health
```

**Site config API:**

```bash
# List sites
curl http://127.0.0.1:8081/api/sites

# Create a test site
curl -X POST http://127.0.0.1:8081/api/sites \
  -H "Content-Type: application/json" \
  -d '{"domain":"test.com","persona_name":"TestBot"}'
```

**WebSocket test (Python):**

```python
import asyncio, websockets, json

async def test():
    async with websockets.connect("ws://127.0.0.1:8081/ws/demo/test") as ws:
        await ws.send(json.dumps({"type": "text", "text": "Hello!"}))
        async for msg in ws:
            data = json.loads(msg)
            if data.get("content", {}).get("parts"):
                for part in data["content"]["parts"]:
                    if "text" in part:
                        print(f"Agent: {part['text']}")
                    elif "inlineData" in part:
                        print(f"Audio: {part['inlineData']['mimeType']}")
            if data.get("turnComplete"):
                break

asyncio.run(test())
```

## Embed Script Development

### Setup

```bash
cd embed
npm install
```

### Building

**One-time build:**

```bash
npm run build
# → dist/webclaw.js  19.6kb ⚡ Done in 2ms
```

**Watch mode (rebuild on change):**

```bash
npx esbuild src/index.ts \
  --bundle \
  --minify \
  --format=iife \
  --global-name=WebClaw \
  --outfile=dist/webclaw.js \
  --watch
```

### Module Architecture

| Module | Responsibility |
|:-------|:---------------|
| `index.ts` | Main entry, Shadow DOM overlay, UI state machine, event wiring |
| `avatar.ts` | Canvas 2D animated face, lip-sync, eye blinks, state animations |
| `gateway-client.ts` | WebSocket client, event emitter, message serialization |
| `audio.ts` | Mic capture (16kHz PCM), playback (24kHz PCM), Web Audio API |
| `dom-actions.ts` | DOM action executor, smart element finder (CSS/ARIA/text) |
| `dom-snapshot.ts` | Token-efficient DOM serializer for agent context |
| `element-finder.ts` | 3-strategy element lookup (CSS → ARIA → text content) |
| `overlay.ts` | (Legacy) overlay component |

### Bundle Analysis

The embed script produces a single IIFE bundle with zero runtime dependencies:

```
dist/webclaw.js
├── index.ts             (~8KB)  Entry + UI
├── avatar.ts            (~4KB)  Canvas animation
├── action-visualizer.ts (~3KB)  Bezier flight animation
├── gateway-client.ts    (~3KB)  WebSocket
├── screenshot.ts        (~3KB)  Viewport capture
├── audio.ts             (~2KB)  Web Audio
├── dom-actions.ts       (~1.5KB) DOM executor
└── dom-snapshot.ts      (~1.1KB) DOM serializer
                         --------
Total:                   26.1KB minified
```

### Testing the Embed Script

Open the demo site with the gateway running:

```bash
# Terminal 1: Gateway
cd gateway && source .venv/bin/activate && uvicorn main:app --port 8081

# Terminal 2: Demo site
cd demo-site && python -m http.server 3000

# Browser: http://localhost:3000
```

Or use the gateway's built-in demo mount: `http://127.0.0.1:8081/demo`

## Chrome Extension Development

### Loading the Extension

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `extension/`
4. Pin the WebClaw icon to your toolbar

### Debugging

**Popup:** Right-click the toolbar icon → "Inspect Popup"

**Content script:** Open DevTools on any page → Console. Content script logs are prefixed with `[WebClaw]`.

**Service worker:** Go to `chrome://extensions` → click "Inspect views: service worker" under the WebClaw entry.

### Reloading After Changes

Click the refresh icon (🔄) on the extension card in `chrome://extensions`. For content script changes, also refresh the target page.

## End-to-End Testing

### Full Stack Local Test

```bash
# 1. Start gateway
cd gateway && source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8081 &

# 2. Build embed
cd ../embed && npm run build

# 3. Open demo
open http://127.0.0.1:8081/demo
```

### Verified Test Output

A successful end-to-end test produces this pattern:

```
Gateway logs:
  WebSocket connect: site=demo session=test456
    Trying to connect to live model: gemini-2.5-flash-native-audio-preview-12-2025
  Update session resumption handle: new_handle=...

Client receives:
  AUDIO: audio/pcm;rate=24000 (12800 b64 chars)
  AUDIO: audio/pcm;rate=24000 (15360 b64 chars)
  ...
  EVT: ['turnComplete', ...]
```

### Common Development Issues

| Issue | Cause | Fix |
|:------|:------|:----|
| `ModuleNotFoundError: google.adk` | venv not activated | `source .venv/bin/activate` |
| `GOOGLE_API_KEY not set` | Missing `.env` file | `cp .env.example .env` and add key |
| WebSocket connects but no response | Wrong model name | Check `agent/agent.py` model supports `bidiGenerateContent` |
| Embed script 404 | Not built | `cd embed && npm run build` |
| CORS errors | Gateway not running | Start gateway first |
| Extension not injecting | Page not refreshed | Refresh the page after loading extension |

## Code Style

- **Python:** Standard library conventions, type hints, `logging` over `print`
- **TypeScript:** Strict mode, no `any`, explicit return types
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`)
