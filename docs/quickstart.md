# Quick Start

Get WebClaw running locally in 5 minutes. By the end of this guide, you will have the gateway serving an AI agent that responds to voice and text over WebSocket, connected to a demo e-commerce site.

## Prerequisites

| Tool | Version | Installation |
|:-----|:--------|:-------------|
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) or `brew install python` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) or `brew install node` |
| Gemini API Key | - | [Google AI Studio](https://aistudio.google.com/apikey) (free) |

## Step 1: Clone the Repository

```bash
git clone https://github.com/AfrexAI/webclaw.git
cd webclaw
```

## Step 2: Start the Gateway

The gateway is a Python FastAPI application that hosts the ADK agent and serves the WebSocket endpoint.

```bash
cd gateway

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate    # macOS / Linux
# .venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

Configure your API key:

```bash
cp gateway/.env.example gateway/.env
```

Edit `gateway/.env` and set your Gemini API key and dashboard credentials:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=use_a_unique_password_at_least_16_characters
ADMIN_SESSION_SECRET=use_a_random_secret_at_least_32_characters
```

Start the server:

```bash
uvicorn main:app --host 127.0.0.1 --port 8081
```

You should see:

```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8081 (Press CTRL+C to quit)
```

### Verify the Gateway

Health check:

```bash
curl http://127.0.0.1:8081/health
```

```json
{"status": "ok", "service": "webclaw-gateway", "version": "0.3.0"}
```

List registered sites:

```bash
curl http://127.0.0.1:8081/api/sites
```

```json
{
  "sites": [{
    "site_id": "demo",
    "domain": "localhost",
    "persona_name": "BizGrow Holdings",
    "welcome_message": "Hey! I'm the BizGrow Holdings website assistant..."
  }]
}
```

## Step 3: Build the Embed Script

The embed script is a TypeScript bundle that creates the overlay UI, manages audio, and communicates with the gateway over WebSocket.

```bash
cd ../embed
npm install
npm run build
```

Output:

```
dist/webclaw.js  19.6kb ⚡ Done in 2ms
```

## Step 4: Open the Demo Site

The demo site is a static e-commerce store (TechByte) with WebClaw pre-integrated.

**Option A: Direct file open**

```bash
open ../demo-site/index.html
```

**Option B: Serve via the gateway**

The gateway auto-mounts the demo site at `/demo`:

```
http://127.0.0.1:8081/demo
```

**Option C: Local HTTP server**

```bash
cd ../demo-site
python -m http.server 3000
# → http://localhost:3000
```

## Step 5: Interact with WebClaw

1. Look for the **round avatar button** in the bottom-right corner of the page
2. Click it to open the chat panel
3. Type a message like "What products do you sell?" and press Enter
4. The agent will respond with voice audio and text

### Voice Interaction

Click the **microphone icon** in the chat panel to enable voice mode. Speak naturally. The agent will hear you through the Gemini Live API and respond with synthesized speech.

> **Note:** Your browser will ask for microphone permission the first time. The Chrome Extension mode grants this persistently.

## What You Should See

| Indicator | Meaning |
|:----------|:--------|
| Avatar breathing gently | Agent is idle and ready |
| Blue glow ring | Agent is listening (mic active) |
| Green glow, mouth moving | Agent is speaking |
| Spinning arc | Agent is thinking |
| Lightning bolt ⚡ | Agent is executing a DOM action |

## Next Steps

- **[Site Owner Guide](site-owner-guide.md)**: Configure WebClaw for your own website
- **[Personal Agent Guide](personal-agent-guide.md)**: Install the Chrome extension
- **[Architecture](architecture.md)**: Understand how the components fit together
- **[GCP Deployment](deployment-gcp.md)**: Deploy to production on Google Cloud
