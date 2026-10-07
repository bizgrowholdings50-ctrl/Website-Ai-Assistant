# Building WebClaw: A Voice-First AI Agent That Actually Operates Websites

*How we built a live agent that sees, hears, speaks, and acts on web pages, powered by Google Gemini's bidirectional audio streaming.*

---

## The Problem Nobody Talks About

Website support is stuck in 2015. Chat widgets serve canned responses. Users abandon carts because they can't find the checkout button. Support staff ask "can you send a screenshot?" because they can't see what the user sees.

Every interaction starts from zero.

We wanted to build something different: an AI agent that doesn't just *answer questions* about a website, but actually *operates* it alongside you. Click buttons. Fill forms. Navigate pages. All through natural conversation.

That's WebClaw.

## What WebClaw Does

WebClaw is a voice-first AI agent that lives on websites. Site owners add a single `<script>` tag (the same pattern as Google Analytics), and visitors get an animated avatar they can talk to. The agent can:

- **See** the page through DOM snapshots and screenshots
- **Hear** the user through real-time microphone streaming
- **Speak** back with natural voice (supporting barge-in)
- **Act** on the DOM: clicking, typing, scrolling, navigating, highlighting

Say "help me check out" and the agent navigates to the cart, walks you through the form, and confirms the order. It doesn't paste a link to the checkout page.

There's also a Chrome Extension mode (Personal Agent) that works on *any* website, not just integrated ones. When a Personal Agent visits a WebClaw-integrated site, the two negotiate: the site shares its knowledge base, the agent keeps the user's data private. Privacy by architecture, not policy.

## The Tech Stack

### Gemini Live API: The Core

The entire project hinges on Gemini's `bidiGenerateContent` method. This isn't request-response; it's a persistent bidirectional stream. Audio flows in both directions simultaneously. The user can interrupt the agent mid-sentence (barge-in). The agent can call functions while speaking.

We use `gemini-2.5-flash-native-audio-preview-12-2025` because it supports `bidiGenerateContent` for live audio with native voice generation and function calling. The native audio model produces higher-quality, more natural voice output than the older experimental models.

### Google ADK: Agent Scaffolding

The Agent Development Kit handles the ceremony: session management, function-calling schema generation, the `LiveRequestQueue` abstraction for feeding audio and text into the bidi stream. Our agent definition is clean:

```python
root_agent = Agent(
    name="webclaw_agent",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    instruction=WEBCLAW_SYSTEM_PROMPT,
    tools=DOM_TOOLS,
)
```

Ten DOM tools are registered as typed Python functions. ADK converts them to Gemini function-calling schemas automatically. When the model decides to click a button, it returns a `function_call` event that we forward to the browser for execution.

### The Gateway: FastAPI + WebSocket

The gateway sits between the browser and Gemini, running on Cloud Run. Each visitor gets a WebSocket connection that spawns two async tasks:

```
Browser --> Upstream Task --> LiveRequestQueue --> Gemini
                                                    |
Browser <-- Downstream Task <-- runner.run_live() <-+
```

Full duplex. The user speaks while the agent responds. DOM action results flow back while the agent processes the next thought.

Why not connect the browser directly to Gemini? Four reasons:

1. **Privacy.** The gateway enforces asymmetric context sharing. Site JavaScript can't intercept user data.
2. **Security.** DOM actions are validated against the site's permission list before execution.
3. **Scalability.** Cloud Run auto-scales with session affinity for WebSocket stability.
4. **Analytics.** Session history, message counts, and action metrics, all stored in Firestore.

### The Embed Script: 26.1KB of TypeScript

The client-side embed script runs in a closed Shadow DOM (complete CSS isolation from the host page) and weighs 26.1KB minified. No runtime dependencies. It includes:

- **Animated avatar** (Canvas 2D with lip-sync, eye blinks, state transitions)
- **Action visualizer** (avatar flies to target elements via bezier curve with trail particles)
- **Screenshot capture** (Canvas-based viewport rendering for vision context)
- **Audio pipeline** (16kHz mic capture, 24kHz playback, raw PCM, no codecs)
- **Smart element finder** (CSS selector, then aria-label, then text content match)

We chose esbuild for bundling: 2ms build time, zero config. The avatar uses Canvas 2D instead of Lottie (+50KB) or Three.js (+150KB) because every kilobyte matters in an embed script loaded on every page view.

## Hard Problems We Solved

### The Model Migration

We started development targeting `gemini-2.0-flash-live-001`. Midway through, we discovered it no longer exists in the API. We queried every available model for `bidiGenerateContent` support and found several options:

| Model                                       | bidi | generate | Notes                            |
| ------------------------------------------- | ---- | -------- | -------------------------------- |
| `gemini-2.5-flash-native-audio-preview-12-2025` | ✅   | ❌       | Current default; native audio with function calling |
| `gemini-2.5-flash-native-audio-latest`    | ✅   | ❌       | Tracks latest stable native-audio model |
| `gemini-2.0-flash-exp-image-generation`   | ✅   | ✅       | Legacy; broadest capability but older |

We chose the native audio model for its superior voice quality and lower latency in real-time conversations.

### Token-Efficient DOM Serialization

A typical webpage's full DOM is 50,000+ tokens. We needed to fit page context into the LLM's window without drowning out the conversation. Our serializer:

- Includes only interactive elements (buttons, links, inputs) and semantic elements (headings, nav, main)
- Excludes scripts, styles, SVGs, iframes
- Caps depth at 3 levels
- Caps output at 4,000 characters

The result captures the page's interactive surface area in roughly 500 tokens.

### Action Visualization

When the agent clicks a button, users need to *see* what happened. We built a bezier flight animation: a glowing indicator launches from the avatar, arcs upward, and lands on the target element with a pulse ring effect. Trail particles follow with a delayed, staggered motion. The whole animation runs in 600ms using `requestAnimationFrame` with cubic ease-in-out.

This transforms "the agent clicked something" into "I watched the agent fly to that button and click it." Agency you can see.

### Asymmetric Privacy

When a Personal Agent (Chrome Extension) visits a WebClaw-integrated site, context flows in one direction:

```
Site Knowledge ------> Agent Context <------ User Preferences
    (public)              (merged)              (private)
                                                   |
                                             NEVER flows to
                                             ----> Site Owner
```

This isn't a policy in the terms of service. It's infrastructure. The gateway physically can't leak user data to the site because the data flow is architecturally one-directional. The negotiation protocol (`negotiate` / `negotiate_ack` messages) establishes what the site offers and what the agent may do, without exposing who the user is or what they've done on other sites.

## What We Built in Numbers

| Component             | Metric                                                                       |
| --------------------- | ---------------------------------------------------------------------------- |
| Gateway               | 18 REST endpoints, WebSocket bidi streaming                                  |
| Embed script          | 26.1KB minified, 8 TypeScript modules                                        |
| Chrome Extension      | MV3, 4 files, negotiation protocol                                           |
| Dashboard             | Vanilla HTML/JS, 5 pages, no build step                                      |
| Documentation         | 14 pages, 3,700+ lines, 150KB+                                               |
| DOM tools             | 8 operations (click, type, scroll, navigate, highlight, read, select, check) |
| Firestore collections | 4 (sites, sessions, knowledge, stats)                                        |

## Lessons Learned

**Voice-first changes everything.** When you design for speech as the primary modality, the entire UX shifts. Text fallback is trivial to add; designing for voice from scratch is not. We built the audio pipeline first and added text second.

**Shadow DOM is non-negotiable for embeds.** We tried CSS namespacing first. Host pages with `* { box-sizing: border-box; margin: 0; }` destroyed our overlay. Closed Shadow DOM solves it permanently, and unlike iframes, we can still observe and act on the host page's DOM.

**Raw PCM beats codecs for live streaming.** Gemini accepts and produces raw PCM. Adding Opus encoding/decoding would introduce latency and complexity for zero benefit. Shortest path wins.

**Build the dashboard last.** We almost built a React dashboard early on. Instead, we finished all features first, then wrote a single HTML file with vanilla JS that calls the same REST API. 640 lines, no build step, no dependencies, ships in the Docker image. Sometimes the boring solution is the right one.

## Try It

WebClaw is open source. Clone the repo, set your `GOOGLE_API_KEY`, and run:

```bash
cd gateway && pip install -r requirements.txt && uvicorn main:app --port 8081
cd embed && npm install && npm run build
# Open http://localhost:8081/demo
```

Or deploy to Cloud Run with a single command:

```bash
cd infra && ./deploy.sh
```

The demo site is a fake e-commerce store (TechByte) where you can ask the agent to add products to cart, find specific items, or navigate the FAQ.

---

*Built by David Nzagha and the Nzagha Ventures team for the Gemini Live Agent Challenge.*

*WebClaw is a submission to the Gemini API Developer Competition (Live Agents category). Built with Gemini Live API, Google ADK, and Google Cloud Run.*
