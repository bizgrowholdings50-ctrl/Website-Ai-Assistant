# WebClaw

**A Personal Live Agent for Website Operations and Support**

> *What if every website had an intelligent, voice-enabled agent that could actually do things for you, not just answer questions into the void?*

---

## The Problem

The current website support experience is broken:

1. **Chat widgets are dumb.** A chat bubble appears. You type into it. A bot responds with canned answers, or you wait 12 minutes for a human who asks you to repeat everything. The interaction is text-only, turn-based, and disconnected from the actual website you're trying to use.

2. **Users struggle alone.** People abandon carts, fail to complete forms, can't find features, and leave. The website has all the functionality they need, but no one to guide them through it.

3. **Support agents are blind.** Human support staff can't see what the user sees. They can't click buttons for them. They can't navigate the site on the user's behalf. They're limited to saying "click the blue button on the top right" and hoping the user understands.

4. **No personalization.** Every support interaction starts from zero. The widget knows nothing about you, your preferences, your history across other sites, or what you're actually trying to accomplish.

**The result:** billions of dollars lost to abandoned workflows, frustrated users, and support teams that are reactive instead of proactive.

---

## The Solution: WebClaw

WebClaw is **OpenClaw for the web**. It's a live, voice-enabled AI agent that lives on websites and can actually operate the site on behalf of the user. It sees, speaks, listens, and acts.

### Two Modes, One Experience

**1. Website-Provided Agent (Site Mode)**

Website owners integrate WebClaw by adding a single `<script>` tag, just like existing support solutions (Intercom, Drift, Zendesk). They preconfigure a WebClaw agent with:

- Their site's knowledge base, FAQs, and documentation
- Allowed actions (what the agent can do on the site)
- Brand voice and persona
- Escalation rules (when to hand off to human support)
- Site-specific skills (checkout flow, form filling, navigation)

The agent operates within the boundaries the site owner defines. It can guide users, execute tasks, and provide support, all without the user needing to install anything.

**2. Personal Agent (User Mode)**

Users install the **WebClaw browser extension**. This is their personal agent that travels with them across the web. It:

- Inherits their **OpenClaw Soul** (personality, preferences, memory)
- Carries their **OpenClaw Skills** (capabilities from their personal agent)
- Has context about their personal information, preferences, and history
- Can operate any website on their behalf, not just WebClaw-integrated ones
- Speaks without repeated microphone permission prompts (granted once at extension install)
- Maintains continuity across sites and sessions

When a user with a Personal WebClaw visits a WebClaw-integrated site, their personal agent seamlessly connects with the site's Gateway. The personal agent gains access to site-specific knowledge and capabilities while the site gains nothing beyond what's necessary to serve the user.

### The Gateway

The WebClaw Gateway is the core infrastructure that makes this work. It is a managed service that:

- **Brokers context** between the website's knowledge base and the executing WebClaw agent
- **Manages permissions** for what the agent can see and do
- **Handles agent negotiation** when a Personal WebClaw meets a Site WebClaw
- **Streams real-time audio** (Gemini Live API) for natural voice interaction
- **Coordinates DOM operations** so the agent can act on the page
- **Provides the overlay UI** (the agent avatar, visual feedback, action indicators)
- **Exposes analytics** for site owners (what users ask, where they struggle, task completion rates)

---

## User Experience

### What the User Sees

A **round overlay component** sits in the bottom-right corner of the website. Inside the circle is the **agent's animated avatar**, which lip-syncs as it speaks.

**Idle state:** The avatar breathes gently, occasionally blinking. A subtle pulse indicates the agent is available.

**Listening state:** The avatar's eyes track attentively. A waveform ring appears around the circle, visualizing the user's speech input.

**Speaking state:** The avatar's mouth moves in sync with its speech. The circle gently pulses with each syllable.

**Executing state:** When the agent acts on the page, the avatar lifts out of its corner position and **moves to the DOM element it's interacting with**. A spotlight or highlight effect draws attention to the element. The user watches the agent navigate the page in real-time, like a screen-sharing session with a helpful friend.

**Thinking state:** The avatar shows a contemplative expression. A subtle loading indicator appears, but the agent can still listen (barge-in supported).

### What the User Hears

Natural, conversational voice. Not robotic TTS. The agent:

- Speaks proactively: "I see you've been on this pricing page for a while. Want me to walk you through the plans?"
- Responds to voice: The user just talks. No typing. No clicking a mic button (for Personal WebClaw).
- Handles interruptions: "Actually, wait, go back to the..." and the agent stops, listens, adjusts.
- Explains as it acts: "I'm filling in your shipping address now. Let me know if this looks right."

### What the User Does

**Nothing special.** They talk to the agent like they'd talk to a helpful person sitting next to them:

- "Help me check out"
- "What's the return policy?"
- "Fill in my address, it's the same as last time"
- "Compare these two products side by side"
- "I can't find where to change my password"
- "Book the 3pm slot for Thursday"

The agent understands, navigates, clicks, types, scrolls, and completes the task while the user watches.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                     User's Browser                       │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │  WebClaw      │    │  Target Website               │   │
│  │  Extension    │    │                               │   │
│  │  (Personal    │    │  ┌─────────────────────────┐  │   │
│  │   Agent)      │◄──►│  │  WebClaw Embed Script   │  │   │
│  │              │    │  │  (Site Agent + Overlay)  │  │   │
│  └──────┬───────┘    │  └────────────┬────────────┘  │   │
│         │            │               │                │   │
│         └────────────┼───────────────┘                │   │
│                      │                                │   │
└──────────────────────┼────────────────────────────────┘   
                       │                                    
                       ▼                                    
          ┌────────────────────────┐                        
          │    WebClaw Gateway     │                        
          │    (Google Cloud)      │                        
          │                        │                        
          │  ┌──────────────────┐  │                        
          │  │  Agent Runtime   │  │                        
          │  │  (Gemini Live)   │  │                        
          │  ├──────────────────┤  │                        
          │  │  Context Broker  │  │                        
          │  │  (Knowledge +    │  │                        
          │  │   Permissions)   │  │                        
          │  ├──────────────────┤  │                        
          │  │  Action Engine   │  │                        
          │  │  (DOM Commands)  │  │                        
          │  ├──────────────────┤  │                        
          │  │  Voice Pipeline  │  │                        
          │  │  (STT ↔ TTS)    │  │                        
          │  ├──────────────────┤  │                        
          │  │  Session Store   │  │                        
          │  │  (Firestore)     │  │                        
          │  └──────────────────┘  │                        
          └────────────────────────┘                        
                       │                                    
                       ▼                                    
          ┌────────────────────────┐                        
          │  Site Owner Dashboard  │                        
          │  (Configuration +      │                        
          │   Analytics + KB)      │                        
          └────────────────────────┘                        
```

### Integration Flow (Site Owner)

```
1. Site owner signs up at webclaw.dev
2. Configures agent: persona, knowledge base, allowed actions, brand voice
3. Gets a script tag:

   <script src="https://gateway.webclaw.dev/embed.js" 
           data-site-id="site_abc123"></script>

4. Adds it to their website (same as adding Google Analytics or Intercom)
5. WebClaw agent appears on their site, ready to help visitors
```

### Personal Agent Flow (User)

```
1. User installs WebClaw browser extension
2. Extension connects to their OpenClaw instance (or creates a new WebClaw account)
3. Soul, skills, and preferences sync to the extension
4. On any website:
   a. Non-integrated site: Personal agent operates independently using 
      Gemini vision to understand the page
   b. Integrated site: Personal agent connects to the site's Gateway, 
      gaining access to the site's knowledge base and action capabilities
      while maintaining user privacy
```

### Agent Negotiation Protocol

When a Personal WebClaw meets a Site WebClaw:

```
Personal Agent                    Gateway                    Site Agent
     │                              │                            │
     │──── ANNOUNCE (capabilities) ──►                           │
     │                              │──── NEGOTIATE ────────────►│
     │                              │◄─── OFFER (kb, actions) ──│
     │◄─── CONTEXT_GRANT ──────────│                            │
     │                              │                            │
     │  Personal agent now has:     │                            │
     │  - Site knowledge base       │                            │
     │  - Allowed DOM actions       │                            │
     │  - User's personal context   │                            │
     │  (Site does NOT get user's   │                            │
     │   personal data)             │                            │
     │                              │                            │
```

The Gateway enforces **asymmetric context sharing**: the site's knowledge flows to the agent, but the user's personal context stays with the user's agent. The site only receives anonymized interaction analytics.

---

## Technical Stack

### Mandatory (Challenge Requirements)

| Component | Technology | Requirement Met |
|---|---|---|
| AI Model | **Gemini 2.5 Flash** (Native Audio) | Gemini model ✓ |
| Agent Framework | **Google ADK** (Agent Development Kit) | GenAI SDK or ADK ✓ |
| Real-time Voice | **Gemini Live API** | Live API ✓ |
| Backend Hosting | **Google Cloud Run** | Google Cloud service ✓ |
| Session Storage | **Firestore** | Google Cloud service ✓ |
| Vision/DOM Understanding | **Gemini Multimodal** | Multimodal ✓ |

### Full Stack

| Layer | Technology |
|---|---|
| **Gateway Backend** | Python (FastAPI) on Cloud Run |
| **Agent Runtime** | Google ADK + Gemini Live API |
| **Voice Pipeline** | Gemini Live API (bidirectional audio streaming) |
| **Embed Script** | TypeScript (zero dependencies, 26.1KB minified) |
| **Browser Extension** | Chrome Extension (Manifest V3) |
| **Overlay UI** | Web Components (shadow DOM for style isolation) |
| **Avatar Rendering** | Canvas 2D (lip-sync animation, zero dependencies) |
| **DOM Interaction** | Custom action engine (click, type, scroll, highlight) |
| **Knowledge Base** | Firestore + Vertex AI Vector Search |
| **Site Dashboard** | Next.js on Cloud Run |
| **Auth** | Firebase Auth |
| **Analytics** | BigQuery |
| **IaC** | Terraform (bonus points) |

---

## Challenge Category

**Live Agents** (Primary)

WebClaw is fundamentally a Live Agent: real-time audio/vision interaction where users talk naturally with an AI that can see and act on their screen.

**Why this wins on judging criteria:**

| Criterion (Weight) | How WebClaw Scores |
|---|---|
| **Innovation & Multimodal UX (40%)** | Breaks the text box paradigm entirely. Users talk; agent talks back AND acts. Avatar lip-sync, DOM navigation animation, voice barge-in. Not a chatbot with a mic icon, it's a companion that operates the website. |
| **Technical Implementation (30%)** | Full ADK agent with Gemini Live API, multimodal DOM understanding, real-time bidirectional audio, context brokering, permission system. Cloud Run + Firestore + Vertex AI. Robust error handling for DOM mutations, network drops, permission boundaries. |
| **Demo & Presentation (30%)** | Extremely demo-friendly. "Watch the agent navigate to checkout, fill in the form, and complete the purchase while explaining what it's doing." Visual, live, undeniable. |

**Cross-category appeal:**

- Also qualifies for **UI Navigator** (the agent literally navigates and operates UI)
- The avatar lip-sync and voice interaction touch **Creative Storyteller** territory

---

## MVP Scope (11 Days)

### Must Have (Core Demo)

- [ ] **Gateway backend** on Cloud Run (FastAPI + ADK + Gemini Live API)
- [ ] **Embed script** (`<script>` tag integration, <50KB)
- [ ] **Overlay UI** (round avatar component, bottom-right positioning)
- [ ] **Voice interaction** (user speaks, agent responds via Gemini Live API)
- [ ] **DOM awareness** (agent can see and describe the current page via screenshots/DOM snapshots)
- [ ] **DOM actions** (click, type, scroll, navigate, highlight elements)
- [ ] **Live action visualization** (avatar moves to elements, highlight effects)
- [ ] **Simple knowledge base** (site owner uploads FAQ/docs, agent uses them)
- [ ] **Demo website** (e-commerce or SaaS site to showcase WebClaw on)

### Should Have (Differentiation)

- [ ] **Avatar lip-sync** (mouth animation synced to TTS output)
- [ ] **Barge-in support** (user can interrupt the agent mid-sentence)
- [ ] **Browser extension** (Personal WebClaw, basic version)
- [ ] **Agent negotiation** (Personal agent connects to Site agent)
- [ ] **Site owner dashboard** (basic config: persona, knowledge base)

### Nice to Have (Bonus Points)

- [ ] **Terraform deployment** (automated GCP deployment, +0.2 pts)
- [ ] **Blog post** (how we built it, +0.6 pts)
- [ ] **GDG membership** (+0.2 pts)
- [ ] **OpenClaw Soul/Skills inheritance** in extension
- [ ] **Analytics dashboard** for site owners

---

## Differentiation

### vs. Existing Chat Widgets (Intercom, Drift, Zendesk)

| Feature | Chat Widgets | WebClaw |
|---|---|---|
| Interaction mode | Text typing | Natural voice conversation |
| Can operate the website | No | Yes, navigates and acts on DOM |
| Visual feedback | Chat bubble | Animated avatar that moves to elements |
| Personalization | Per-site only | Personal agent travels across sites |
| Integration effort | Script tag | Script tag (identical) |
| Support agent required | Yes, for complex issues | Agent handles most tasks autonomously |

### vs. AI Assistants (ChatGPT, Gemini Chat)

| Feature | AI Chat | WebClaw |
|---|---|---|
| Website awareness | None (separate tab) | Lives on the website, sees everything |
| Can act on pages | No | Yes, clicks, types, navigates |
| Site-specific knowledge | No | Yes, integrated knowledge base |
| Voice interaction | Separate interface | Inline, contextual |
| Always present | Requires switching apps | Always there on the page |

### vs. Browser Agents (OpenAI Operator, Google Project Mariner)

| Feature | Browser Agents | WebClaw |
|---|---|---|
| Runs in | Separate browser/tab | On the actual website |
| User watches | Remote screen | Their own screen, live |
| Site owner control | None | Full control over agent capabilities |
| Knowledge base | General | Site-specific + personal |
| Voice interaction | Limited | Core feature, real-time |
| Privacy | Agent sees everything | Gateway manages context exposure |

---

## Business Potential (Post-Hackathon)

WebClaw is not just a hackathon project. It's a platform:

- **Freemium SaaS** for website owners (free tier: 1K conversations/mo)
- **Personal agent subscription** for power users
- **Enterprise tier** with custom deployment, SSO, compliance
- **Marketplace** for WebClaw skills (checkout optimization, onboarding flows, etc.)
- **API access** for programmatic agent configuration

The market for website support tools is $15B+ and growing. WebClaw replaces the entire category with something fundamentally better.

---

## Project Structure

```
webclaw/
├── CHALLENGE.md              # Competition rules (reference)
├── CONCEPT.md                # This document
├── README.md                 # Public README (for Devpost submission)
├── gateway/                  # Gateway backend (FastAPI + ADK)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py               # FastAPI app
│   ├── agent/                # ADK agent definition
│   │   ├── agent.py          # Core agent logic
│   │   ├── tools.py          # DOM action tools
│   │   └── prompts.py        # System prompts
│   ├── voice/                # Gemini Live API integration
│   │   ├── pipeline.py       # Audio streaming
│   │   └── lipsync.py        # Viseme generation for avatar
│   ├── context/              # Context broker
│   │   ├── broker.py         # Knowledge + permission management
│   │   └── negotiation.py    # Agent negotiation protocol
│   └── config/               # Site configuration
│       └── schema.py         # Configuration models
├── embed/                    # Embed script (site integration)
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── overlay.ts        # Avatar overlay component
│   │   ├── avatar.ts         # Avatar rendering + lip-sync
│   │   ├── dom-actions.ts    # DOM interaction engine
│   │   ├── audio.ts          # WebRTC/WebSocket audio
│   │   └── gateway-client.ts # Gateway communication
│   ├── build.ts              # Build to single JS file
│   └── package.json
├── extension/                # Browser extension (Personal WebClaw)
│   ├── manifest.json         # Manifest V3
│   ├── background.ts         # Service worker
│   ├── content.ts            # Content script
│   ├── popup/                # Extension popup UI
│   └── soul/                 # OpenClaw Soul/Skills sync
├── dashboard/                # Site owner dashboard
│   ├── src/
│   └── package.json
├── demo-site/                # Demo website for showcase
│   ├── src/
│   └── package.json
├── infra/                    # Infrastructure as Code
│   ├── main.tf               # Terraform config
│   └── variables.tf
├── diagrams/                 # Architecture diagrams
└── docs/                     # Additional documentation
```

---

## Timeline (11 Days)

| Day | Date | Focus | Deliverables |
|---|---|---|---|
| 1 | Mar 6 | Foundation | Project setup, Gateway skeleton (FastAPI + Cloud Run), Gemini Live API proof-of-concept, basic audio streaming |
| 2 | Mar 7 | Voice Pipeline | Bidirectional audio via WebSocket, Gemini Live API integration, basic conversation working |
| 3 | Mar 8 | Embed Script | Overlay component, avatar placeholder, script tag integration, DOM snapshot capture |
| 4 | Mar 9 | DOM Engine | DOM action tools (click, type, scroll, navigate), action visualization (highlight, spotlight) |
| 5 | Mar 10 | Agent Brain | ADK agent with DOM tools, Gemini multimodal for page understanding, knowledge base (Firestore + vector search) |
| 6 | Mar 11 | Avatar | Lip-sync animation, avatar states (idle, listening, speaking, executing), movement animation to DOM elements |
| 7 | Mar 12 | Demo Site | Build demo e-commerce site, configure WebClaw agent for it, end-to-end flow working |
| 8 | Mar 13 | Extension | Chrome extension (Manifest V3), personal agent basics, agent negotiation with Gateway |
| 9 | Mar 14 | Polish | Error handling, edge cases, performance, barge-in support, dashboard (basic) |
| 10 | Mar 15 | Deploy + Record | Terraform deployment, GCP proof recording, demo video recording, blog post |
| 11 | Mar 16 | Submit | README, architecture diagram, video upload, Devpost submission (deadline: 5 PM PT) |

---

## Key Design Decisions

### Why "Overlay Avatar" Instead of Chat Window?

A chat window is text-first. WebClaw is action-first. The avatar is a visual anchor that:
- Moves around the page to show what it's doing
- Lip-syncs to maintain the illusion of a present entity
- Takes minimal screen real estate when idle
- Doesn't compete with the website's own UI

### Why Script Tag Integration?

Site owners already understand `<script>` tags. They add Google Analytics, Intercom, Hotjar this way. Zero friction adoption. No SDK, no npm package, no build step. Copy, paste, done.

### Why Browser Extension for Personal Agent?

A browser extension can:
- Request microphone permission once (not per-site)
- Persist across all websites
- Access OpenClaw infrastructure
- Maintain personal context and memory
- Override or enhance site-provided agents

### Why Gateway Architecture (Not Peer-to-Peer)?

The Gateway provides:
- **Privacy**: Site knowledge and user context never directly touch each other
- **Security**: DOM actions are validated and sandboxed
- **Scalability**: Stateless Cloud Run instances
- **Analytics**: Centralized interaction data for site owners
- **Reliability**: No dependency on user's compute

### Why Gemini Live API?

- Native streaming audio (not chunked TTS)
- Barge-in / interruption support
- Multimodal (can process screenshots alongside audio)
- Required by the challenge
- Best-in-class for real-time conversational AI

---

## Name

**WebClaw** = Web + OpenClaw. The claw that reaches into the web and gets things done for you.

---

*Let's build this.*
