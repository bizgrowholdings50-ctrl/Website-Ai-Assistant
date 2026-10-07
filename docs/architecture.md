# System Architecture

This document describes WebClaw's component topology, data flow, concurrency model, and the reasoning behind each architectural decision.

## High-Level Topology

WebClaw follows a **Gateway architecture** where a central server mediates all communication between the user's browser and the Gemini Live API. This is a deliberate choice over peer-to-peer (browser-direct-to-Gemini) for reasons covered in [Design Decisions](#design-decisions).

```
┌─────────────────────────────────────────────────────────────┐
│                       User's Browser                         │
│                                                              │
│  ┌─────────────────┐          ┌───────────────────────────┐ │
│  │ Chrome Extension │          │     Target Website        │ │
│  │ (Personal Agent) │◄────────►│                           │ │
│  └────────┬────────┘          │  ┌─────────────────────┐  │ │
│           │                    │  │  WebClaw Embed      │  │ │
│           │                    │  │  (Shadow DOM)       │  │ │
│           │                    │  └──────────┬──────────┘  │ │
│           └────────────────────┼─────────────┘             │ │
│                                │                            │ │
└────────────────────────────────┼────────────────────────────┘ │
                                 │                               
                     WebSocket (wss://)                          
                    audio + text + DOM                           
                                 │                               
          ┌──────────────────────┴───────────────────────────┐  
          │              WebClaw Gateway                      │  
          │              (Cloud Run)                          │  
          │                                                   │  
          │  ┌─────────────┐  ┌────────────┐  ┌───────────┐ │  
          │  │  FastAPI     │  │  ADK Agent  │  │  Context  │ │  
          │  │  WebSocket   │──│  Runtime    │──│  Broker   │ │  
          │  │  Server      │  │            │  │           │ │  
          │  └─────────────┘  └──────┬─────┘  └───────────┘ │  
          │                          │                        │  
          │                  ┌───────┴────────┐              │  
          │                  │  Session Store  │              │  
          │                  │  (In-Memory /   │              │  
          │                  │   Firestore)    │              │  
          │                  └────────────────┘              │  
          └──────────────────────┬───────────────────────────┘  
                                 │                               
                     gRPC / HTTPS                               
                  Bidirectional Audio                            
                                 │                               
          ┌──────────────────────┴───────────────────────────┐  
          │              Gemini Live API                      │  
          │         (bidiGenerateContent)                     │  
          │                                                   │  
          │  Native audio generation + function calling       │  
          │  Model: gemini-2.5-flash-native-audio-preview    │  
          └──────────────────────────────────────────────────┘  
```

## Component Deep Dive

### Gateway (`gateway/main.py`)

The gateway is a **FastAPI** application (v0.3.0) serving four roles:

1. **REST API server** for site configuration CRUD, knowledge base management, session history, and analytics
2. **WebSocket server** for real-time bidirectional streaming between the browser and the Gemini Live API via ADK
3. **Dashboard host** serving the built-in site owner dashboard at `/dashboard`
4. **Static asset server** serving logos, favicons, and web manifest at `/static/`

**Concurrency model:** Each WebSocket connection spawns two concurrent tasks via `asyncio.gather()`:

- **Upstream task**: reads from the WebSocket (browser), forwards to the ADK `LiveRequestQueue`
- **Downstream task**: reads ADK events from `runner.run_live()`, forwards to the WebSocket (browser)

```
Browser ──WebSocket──► Upstream Task ──► LiveRequestQueue ──► Gemini
                                                                │
Browser ◄──WebSocket── Downstream Task ◄── runner.run_live() ◄──┘
```

This design allows full-duplex communication: the user can speak while the agent is responding (barge-in), and DOM action results flow back while the agent continues processing.

**Session management:** The gateway uses ADK's `InMemorySessionService` for live sessions and **Firestore** for persistent session history. Each WebSocket connection is identified by `(site_id, session_id)`. The session ID is generated client-side. When a WebSocket disconnects, the conversation messages are saved to Firestore under `sites/{site_id}/sessions/{session_id}` with metadata (duration, message count).

### Firestore Storage Layer (`gateway/storage/firestore.py`)

A lazy-initialized Firestore client provides persistent storage with graceful in-memory fallback when Firestore is unavailable (local development without credentials):

| Collection | Purpose |
|:-----------|:--------|
| `sites/{id}` | Site configurations |
| `sites/{id}/sessions/{sid}` | Conversation history (messages, metadata) |
| `sites/{id}/knowledge/{did}` | Structured knowledge base documents |
| `sites/{id}/stats/counters` | Analytics counters (sessions, messages, actions) |

The context broker (`gateway/context/broker.py`) operates as a dual-layer cache: Firestore is the primary store, with in-memory dictionaries as a fast read cache. On first access, configs are loaded from Firestore. All writes go to both layers simultaneously.

### ADK Agent (`gateway/agent/`)

The agent is defined using Google ADK's `Agent` class:

```python
root_agent = Agent(
    name="webclaw_agent",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    description="A live website operations agent...",
    instruction=WEBCLAW_SYSTEM_PROMPT,
    tools=DOM_TOOLS,
)
```

**Model selection:** The model must support `bidiGenerateContent` for the Live API. As of March 2026, the models supporting this method are:

| Model | bidiGenerateContent | generateContent | Notes |
|:------|:---:|:---:|:------|
| `gemini-2.5-flash-native-audio-preview-12-2025` | ✅ | ❌ | Current default; native audio with function calling |
| `gemini-2.5-flash-native-audio-latest` | ✅ | ❌ | Tracks latest stable native-audio model |
| `gemini-2.0-flash-exp-image-generation` | ✅ | ✅ | Legacy; broadest capability but older |

**System prompt:** The agent's system prompt (`agent/prompts.py`) defines its identity, behavioral guidelines, capabilities, and rules. Site-specific context (persona, knowledge base, permissions) is appended dynamically by the `build_site_prompt()` function.

**Tools:** Ten DOM action tools are registered as Python functions with typed signatures. ADK automatically converts these to Gemini function-calling schemas. When the model invokes a tool, the return value (a dict with `action`, `selector`, `status`) is serialized and sent to the browser for execution.

### Context Broker (`gateway/context/broker.py`)

The context broker manages the **asymmetric flow of information** between site knowledge and user context:

```
Site Knowledge ──────► Agent Context ◄────── User Preferences
     (public)              (merged)              (private)
                                                    │
                                              NEVER flows to
                                              ──► Site Owner
```

Core data structure:

```python
@dataclass
class SiteConfig:
    site_id: str
    domain: str
    persona_name: str = "WebClaw"
    persona_voice: str = "friendly and helpful"
    welcome_message: str = "Hi! I'm here to help."
    knowledge_base: str = ""
    allowed_actions: list[str] = [...]
    restricted_actions: list[str] = []
    escalation_email: str = ""
    max_actions_per_session: int = 100
```

The broker merges site knowledge with optional user context into a unified prompt that gets injected at session start via `LiveRequestQueue.send_content()`.

### Embed Script (`embed/src/`)

The embed script is a TypeScript application bundled with esbuild into a single 26.1KB IIFE file. It runs entirely in the browser with zero runtime dependencies.

**Module architecture:**

| Module | Responsibility | Size |
|:-------|:---------------|:-----|
| `index.ts` | Main entry, Shadow DOM overlay, UI state machine | ~450 lines |
| `avatar.ts` | Canvas 2D animated face, lip-sync, state animations | ~225 lines |
| `gateway-client.ts` | WebSocket client, event system, reconnection | ~160 lines |
| `audio.ts` | Mic capture (16kHz), playback (24kHz), Web Audio API | ~106 lines |
| `dom-actions.ts` | DOM action executor, smart element finder | ~148 lines |
| `dom-snapshot.ts` | Token-efficient DOM serializer | ~128 lines |
| `element-finder.ts` | 3-strategy element lookup (CSS → ARIA → text) | ~90 lines |
| `action-visualizer.ts` | Bezier flight animation from FAB to target elements | ~223 lines |
| `screenshot.ts` | Canvas-based viewport capture for vision context | ~213 lines |

**Shadow DOM isolation:** The overlay is wrapped in a `<webclaw-overlay>` custom element with a **closed** Shadow DOM. This provides complete CSS isolation in both directions: WebClaw styles never leak out, host page styles never leak in. This is critical for an embed script that must work on any website regardless of CSS framework.

**Initialization flow:**

```
1. Script tag loads (26.1KB)
2. Read data-* attributes from script tag
3. Register <webclaw-overlay> custom element
4. Create closed Shadow DOM with inline styles
5. Render FAB button with Canvas 2D avatar
6. Wait for user interaction (click or voice activation)
7. On activation: open WebSocket to gateway
8. Send initial DOM snapshot
9. Begin streaming (audio or text)
```

### Chrome Extension (`extension/`)

The extension is a Manifest V3 Chrome Extension with four components:

| File | Role |
|:-----|:-----|
| `manifest.json` | Permissions: `activeTab`, `storage`, `scripting` |
| `background.js` | Service worker for lifecycle management |
| `content.js` | Injected into pages; creates overlay, manages WebSocket, executes DOM actions |
| `popup.html/js` | Settings UI: gateway URL, auto-activate toggle, voice mode, DOM snapshots |

The extension's `content.js` duplicates some embed script functionality (overlay creation, WebSocket management, DOM actions) but adds:

- **Persistent microphone permission** (granted once at extension install)
- **Cross-site persistence** (settings and gateway URL stored in `chrome.storage`)
- **Universal operation** (works on any website, not just WebClaw-integrated ones)
- **Simplified DOM snapshot** (captures interactive elements for agent context)
- **Agent negotiation protocol** (sends capabilities on connect, receives site permissions and persona via `negotiate_ack`)

### Audio Pipeline

WebClaw uses the **Web Audio API** for all audio processing:

**Capture (microphone → gateway):**

```
getUserMedia (mono, 16kHz)
  → MediaStreamSource
    → ScriptProcessorNode (4096 samples/buffer)
      → Float32 → Int16 PCM conversion
        → WebSocket binary frame
```

**Playback (gateway → speakers):**

```
WebSocket binary frame (base64 PCM)
  → Base64 decode → Int16 array
    → Float32 conversion
      → AudioBuffer (24kHz, mono)
        → BufferSourceNode → AudioContext.destination
```

The 16kHz capture / 24kHz playback asymmetry matches Gemini Live API requirements. No codec encoding/decoding (Opus, WebM) is needed because Gemini accepts and produces raw PCM.

### DOM Snapshot Serializer

The DOM snapshot module (`embed/src/dom-snapshot.ts`) creates a **token-efficient** representation of the page for the agent's context window. Full DOM serialization of a typical webpage would consume 50,000+ tokens, so aggressive filtering is applied:

**Inclusion rules:**
- Interactive elements: `button`, `a`, `input`, `select`, `textarea`, `label`
- Semantic elements: `h1`-`h6`, `nav`, `main`, `article`, `section`, `form`
- Elements with `role`, `aria-label`, or `aria-describedby` attributes

**Exclusion rules:**
- `script`, `style`, `svg`, `noscript`, `iframe`
- Elements with `display: none` or `visibility: hidden`
- Depth limit: 3 levels from body
- Character limit: 4,000 characters total

The result is a compact HTML-like string that captures the page's interactive surface area while fitting comfortably in the LLM context window.

## Data Flow: Complete Request Lifecycle

Here is the complete path of a user saying "Add the headphones to my cart":

```
1. User speaks into microphone
2. Web Audio API captures PCM audio at 16kHz
3. ScriptProcessorNode converts Float32 → Int16
4. Binary frame sent over WebSocket to gateway
5. Gateway upstream_task receives binary frame
6. Creates types.Blob(mime_type="audio/pcm;rate=16000")
7. Pushes to LiveRequestQueue.send_realtime()
8. ADK forwards to Gemini Live API (bidiGenerateContent)
9. Gemini processes audio, understands intent
10. Gemini returns:
    a. Audio response chunks (PCM 24kHz, base64)
    b. Function call: click_element(selector=".product-card:nth-child(3) .add-to-cart")
11. ADK yields events to runner.run_live()
12. Gateway downstream_task serializes events to JSON
13. Sends text frames over WebSocket to browser
14. Embed script receives events:
    a. Audio chunks → decode base64 → AudioBuffer → play through speakers
    b. Function call → dom-actions.ts executes click on the element
15. DOM action result sent back to gateway as {"type":"dom_result",...}
16. Gateway forwards result to Gemini as context
17. Gemini generates follow-up: "I've added the headphones to your cart."
```

## Design Decisions

### Why Gateway Architecture (Not P2P)?

A browser-direct-to-Gemini approach would eliminate the gateway server entirely. We chose the gateway for four reasons:

1. **Privacy.** The gateway enforces asymmetric context sharing. Without it, the site's JavaScript could intercept user data flowing through the Gemini connection.

2. **Security.** The gateway validates DOM actions against the site's `allowed_actions` list before forwarding them. A P2P model would trust the browser to enforce permissions.

3. **Scalability.** Cloud Run provides auto-scaling, health checks, and zero-downtime deployments. WebSocket connections are load-balanced with session affinity.

4. **Analytics.** Centralized logging enables site owners to understand what users ask, where they struggle, and which actions succeed or fail.

### Why Shadow DOM?

CSS isolation is non-negotiable for an embed script. The alternative approaches and their problems:

| Approach | Problem |
|:---------|:--------|
| CSS namespacing (`.webclaw-*`) | Host page's `* { }` rules still leak in |
| iframe | Can't access or observe the host page's DOM |
| CSS-in-JS | Runtime overhead; still vulnerable to `!important` rules |
| **Shadow DOM (closed)** | **Complete isolation; can still observe host DOM from outside** |

### Why esbuild?

The embed script must be tiny (loaded on every page view) and build instantly (developer iteration speed). esbuild delivers both: 26.1KB output in 2ms build time. Webpack and Rollup produce comparable output sizes but build 100-1000x slower.

### Why Canvas 2D for the Avatar?

| Option | Size | Deps | Performance | Verdict |
|:-------|:-----|:-----|:------------|:--------|
| Lottie | +50KB (lottie-web) | 1 | Good | Too heavy for embed |
| WebGL/Three.js | +150KB | 1 | Excellent | Massive overkill |
| CSS animations | 0 | 0 | Good | Can't do lip-sync |
| **Canvas 2D** | **~3KB** | **0** | **Good** | **Right balance** |

### Why PCM Over Opus/WebM?

Gemini Live API requires PCM input and produces PCM output. Adding codec encoding/decoding would introduce latency and complexity for zero benefit. The raw PCM approach is the lowest-latency path.
