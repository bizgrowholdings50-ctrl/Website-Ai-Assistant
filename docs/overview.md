# Overview

## What is WebClaw?

WebClaw is a **voice-first AI agent** that lives on websites. It can see the page, hear the user, speak back, and take real actions on the DOM: clicking buttons, filling forms, navigating pages, and highlighting elements. It is not a chatbot. It is a companion that operates the website alongside you.

Traditional website support is broken. Chat widgets serve canned responses. Users abandon carts because they can't find features. Support staff can't see what users see. Every interaction starts from zero. WebClaw fixes all of this.

## How It Works

WebClaw has two complementary modes of operation:

### Site Agent Mode

Website owners integrate WebClaw by adding a single `<script>` tag to their HTML, the same pattern as Google Analytics or Intercom. They configure a persona, knowledge base, allowed actions, and brand voice through the REST API. When a visitor arrives, the embed script (26.1KB) loads a Shadow DOM overlay with an animated avatar. The visitor speaks or types; the agent responds with natural voice and takes actions on the page.

```html
<script src="https://your-gateway.run.app/embed.js"
        data-site-id="your_site_id"
        data-gateway="https://your-gateway.run.app">
</script>
```

### Personal Agent Mode

Users install the WebClaw Chrome Extension. This gives them a personal AI assistant that travels with them across the entire web, not just WebClaw-integrated sites. The extension provides persistent microphone permissions (granted once at install), cross-site context continuity, and the ability to operate any website on the user's behalf.

When a Personal Agent visits a WebClaw-integrated site, the Gateway brokers context between the site's knowledge base and the user's agent while enforcing **asymmetric privacy**: site knowledge flows to the agent, but user data never flows to the site.

## Core Capabilities

| Capability | Description |
|:-----------|:------------|
| **See** | Receives DOM snapshots and screenshots; understands page layout, content, and interactive elements |
| **Hear** | Captures speech via microphone at 16kHz PCM; streams to Gemini Live API in real-time |
| **Speak** | Responds with natural voice at 24kHz PCM; supports barge-in (user can interrupt) |
| **Act** | Executes 10 DOM operations: click, type, scroll, scroll-to-top, scroll-to-bottom, navigate, highlight, read, select, check |
| **Know** | Answers questions using site-specific knowledge bases configured by site owners |
| **Remember** | Maintains session context through Firestore; carries personal context via extension |

## Technology Foundation

WebClaw is built on three Google technologies:

1. **Gemini Live API**: Real-time bidirectional audio streaming with native voice generation. The agent hears and speaks simultaneously through a single persistent connection. No separate STT/TTS pipeline required.

2. **Google Agent Development Kit (ADK)**: Agent lifecycle management, function-calling tool execution, session state, and the `LiveRequestQueue` abstraction for bidirectional streaming.

3. **Google Cloud Run**: Stateless container hosting with session affinity for WebSocket stability, auto-scaling from 0 to N instances, and sub-second cold starts.

## Project Structure

```
webclaw/
├── gateway/          Python FastAPI backend (ADK agent, WebSocket, REST API, Firestore)
├── embed/            TypeScript embed script (Shadow DOM overlay, audio, avatar, action viz)
├── extension/        Chrome Extension MV3 (Personal Agent mode, negotiation protocol)
├── dashboard/        Site owner dashboard (vanilla HTML/JS, served at /dashboard)
├── demo-site/        Demo e-commerce site (TechByte Store)
├── diagrams/         Mermaid source files + rendered SVGs
├── infra/            Terraform + deploy script for GCP
├── docs/             You are here
├── CONCEPT.md        Full design document and product vision
├── CHALLENGE.md      Hackathon rules reference
└── README.md         Project README with quick start
```

## Design Philosophy

**Voice-first, not voice-added.** WebClaw is designed around natural speech as the primary interaction modality. Text input is supported but secondary. The avatar, audio pipeline, and agent prompts are all optimized for spoken conversation.

**Act, don't just answer.** The fundamental difference between WebClaw and a chatbot is agency. When a user says "help me check out," the agent navigates to the cart, fills in the shipping form, and walks the user through confirmation. It does not paste a link to the checkout page.

**Zero-friction integration.** For site owners, integration is a single script tag. For users, it is a browser extension install. No SDKs, no build steps, no configuration files.

**Privacy by architecture.** The asymmetric context broker is not a policy; it is infrastructure. The Gateway physically cannot leak user data to the site because the data flow is one-directional by design.

## Brand Identity

WebClaw's visual identity descends from OpenClaw: a red gradient (`#FF4D4D` to `#991B1B`) with teal accents (`#00E5CC`). The logomark is a geometric claw/shield, the avatar pulses red when idle and teal when listening. Full details, assets, and usage guidelines are in the [Branding](branding.md) reference.
