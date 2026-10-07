# Troubleshooting

Common issues, debugging techniques, and frequently asked questions for WebClaw development and production.

## Quick Diagnostics

Run these checks to identify the problem:

```bash
# 1. Is the gateway running?
curl http://127.0.0.1:8081/health
# Expected: {"status":"ok","service":"webclaw-gateway","version":"0.3.0"}

# 2. Is the API key set?
grep GOOGLE_API_KEY gateway/.env
# Expected: GOOGLE_API_KEY=AIza...

# 3. Is the embed script built?
ls -la embed/dist/webclaw.js
# Expected: 26.1KB file

# 4. Can the gateway serve the embed script?
curl -I http://127.0.0.1:8081/embed.js
# Expected: 200 OK, content-type: application/javascript

# 5. Is the demo site config loaded?
curl http://127.0.0.1:8081/api/sites | python -m json.tool
# Expected: sites array with "demo" entry
```

## Gateway Issues

### Gateway won't start

**Symptom:** `ModuleNotFoundError: No module named 'google.adk'`

**Cause:** Virtual environment not activated or dependencies not installed.

**Fix:**
```bash
cd gateway
source .venv/bin/activate
pip install -r requirements.txt
```

---

**Symptom:** `IndentationError` or `SyntaxError` on startup

**Cause:** Corrupted Python file (usually from a bad edit).

**Fix:**
```bash
python -c "from main import app; print('OK')"
# This will show the exact line with the error
```

---

**Symptom:** `Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY.`

**Cause:** Both environment variables are present.

**Fix:** This is a warning, not an error. The SDK uses `GOOGLE_API_KEY`. Remove `GEMINI_API_KEY` from `.env` if you want to suppress the warning.

### WebSocket connects but no response

**Symptom:** Client connects to WebSocket, sends a message, but receives no agent events.

**Possible causes:**

| Cause | Check | Fix |
|:------|:------|:----|
| Invalid API key | Gateway logs show `401` or `403` | Verify key at [AI Studio](https://aistudio.google.com/apikey) |
| Model doesn't support bidi | Logs show `is not found for API version` | Use a model that supports `bidiGenerateContent` (see below) |
| Rate limited | Logs show `429` | Wait and retry; check API quotas |
| Network issue | No logs after "Trying to connect to live model" | Check firewall/proxy settings |

**Currently supported bidi models (March 2026):**

| Model | `bidiGenerateContent` | `generateContent` |
|:------|:---------------------:|:------------------:|
| `gemini-2.5-flash-native-audio-preview-12-2025` | ✅ | ❌ |
| `gemini-2.5-flash-native-audio-latest` | ✅ | ❌ |
| `gemini-2.0-flash-exp-image-generation` | ✅ | ✅ |

To check available models programmatically:

```python
from google import genai
client = genai.Client(api_key="your_key")
for m in client.models.list():
    if 'bidiGenerateContent' in (m.supported_actions or []):
        print(m.name)
```

### WebSocket error: "Cannot call receive once a disconnect message has been received"

**Symptom:** Error in gateway logs after client disconnects.

**Cause:** The upstream task tried to read from the WebSocket after the client disconnected.

**Fix:** This is handled by the `try/except WebSocketDisconnect` in `upstream_task`. If you see this error, ensure the gateway code has the exception handler:

```python
async def upstream_task() -> None:
    try:
        while True:
            message = await websocket.receive()
            ...
    except WebSocketDisconnect:
        pass
```

### `APIError: 1000 None` or `APIError: 1008 None`

**Symptom:** Error in gateway logs from the Gemini API.

**Cause:** The Gemini Live API session was closed or timed out. Common with:
- Session ID reuse (connecting with the same session_id twice)
- Long idle periods (Gemini closes inactive streams)
- Model deprecation (model no longer available)

**Fix:**
- Generate unique session IDs per connection (`crypto.randomUUID()`)
- Implement reconnection logic with new session IDs
- Check model availability (see model table above)

## Embed Script Issues

### Avatar doesn't appear

**Symptom:** No WebClaw overlay on the page.

**Possible causes:**

| Cause | Check | Fix |
|:------|:------|:----|
| Script not loading | Browser DevTools → Network tab | Verify `src` URL is correct |
| Script 404 | Network shows 404 for `embed.js` | Run `cd embed && npm run build` |
| JavaScript error | DevTools → Console | Check for errors from `webclaw.js` |
| CSP blocking | Console shows CSP violation | Add gateway domain to `connect-src` and `script-src` |

### Microphone not working

**Symptom:** No audio captured when mic button is clicked.

**Checks:**
1. Browser permission: click the lock icon in the URL bar → check microphone permission
2. HTTPS requirement: `getUserMedia` requires HTTPS (or `localhost`)
3. Chrome flags: check `chrome://settings/content/microphone`
4. Other apps: ensure no other app has exclusive mic access

### No audio playback

**Symptom:** Agent responds (events received) but no sound.

**Checks:**
1. System volume is not muted
2. Browser tab is not muted (check tab icon)
3. AudioContext state: some browsers require a user gesture before audio plays
4. DevTools console: look for `AudioContext was not allowed to start` errors

**Fix for autoplay restrictions:**

```javascript
// AudioContext must be created/resumed after user interaction
document.addEventListener('click', () => {
    audioContext.resume();
}, { once: true });
```

### Shadow DOM not isolating styles

**Symptom:** WebClaw overlay looks broken or inherits host page styles.

**Cause:** The Shadow DOM is `open` instead of `closed`, or styles are using `!important` with `::part()`.

**Check:** In DevTools, inspect `<webclaw-overlay>`. The shadow root should show `(closed)`.

## Chrome Extension Issues

### Extension not appearing

**Symptom:** No WebClaw icon in the toolbar after loading.

**Fix:**
1. Check `chrome://extensions`: is the extension enabled?
2. Click the puzzle piece icon → pin WebClaw
3. Check for errors on the extension card

### Content script not injecting

**Symptom:** Extension is installed but the overlay doesn't appear on pages.

**Checks:**
1. Refresh the page (content scripts only inject on navigation)
2. Check the extension's service worker for errors
3. Some pages block content scripts (e.g., `chrome://` pages, Chrome Web Store)
4. Verify `content_scripts.matches` in `manifest.json` includes the target URL pattern

### Settings not persisting

**Symptom:** Gateway URL resets after closing the popup.

**Fix:** Ensure `chrome.storage.local` is being used (not `localStorage`). The popup's `localStorage` is scoped to the popup window and is destroyed when it closes.

## Production Issues

### Cold start latency

**Symptom:** First request after idle period takes 5-10 seconds.

**Fix:**
```bash
gcloud run services update webclaw-gateway \
  --min-instances=1 \
  --region us-central1
```

Setting `min-instances=1` keeps one container warm. Adds ~$15/month in cost.

### WebSocket disconnects on Cloud Run

**Symptom:** WebSocket connections drop after ~10 minutes.

**Cause:** Cloud Run default request timeout is 300 seconds (5 minutes).

**Fix:**
```bash
gcloud run services update webclaw-gateway \
  --timeout=3600 \
  --region us-central1
```

### CORS errors in production

**Symptom:** Browser console shows CORS errors when embed script tries to connect.

**Check:** The gateway allows all origins by default (`allow_origins=["*"]`). If you see CORS errors:

1. Verify the gateway is reachable (not a network/firewall issue masquerading as CORS)
2. Check that the WebSocket URL uses `wss://` (not `ws://`) on HTTPS pages
3. Ensure Cloud Run's IAM allows unauthenticated access

## FAQ

### Can I use a different Gemini model?

Yes. Change the `model` parameter in `gateway/agent/agent.py`. The model must support `bidiGenerateContent` for the Live API. See the model table above.

### Can I disable voice and use text only?

Yes. The embed script supports text-only mode. Users can type in the chat panel without enabling the microphone. The agent will respond with both audio and text (the text is displayed in the chat panel regardless of audio playback).

### How much does the Gemini API cost?

Gemini API pricing varies by model and usage. Check [Google AI pricing](https://ai.google.dev/pricing) for current rates. The `gemini-2.5-flash` family is generally the most cost-effective for real-time applications.

### Can I self-host without GCP?

Yes. The gateway is a standard Python FastAPI application. Run it anywhere that supports Docker or Python:

```bash
cd gateway
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080
```

The only GCP dependency is Firestore (for persistent storage), which is optional in the MVP (uses in-memory storage).

### How do I add my own tools?

Add a new function to `gateway/agent/tools.py` and include it in the `DOM_TOOLS` list:

```python
def my_custom_tool(param: str) -> dict:
    """Description of what this tool does.

    Args:
        param: What this parameter controls.
    """
    return {"action": "my_action", "param": param, "status": "pending"}

DOM_TOOLS = [
    click_element,
    type_text,
    ...
    my_custom_tool,  # Add here
]
```

ADK automatically generates the function-calling schema from the function signature and docstring.

### How do I update the embed script on production sites?

The embed script is served from the gateway at `/embed.js`. When you update and rebuild the embed script, all sites using your gateway automatically get the new version on their next page load. No action needed from site owners.

For CDN deployments, use cache-busting versioning:

```html
<script src="https://cdn.webclaw.dev/embed.js?v=2"></script>
```
