// WebClaw Extension - Content Script
// Injected into web pages. Manages the WebClaw overlay with seamless voice,
// agent switching, and the character avatar.

(() => {
  if (window.__webclawActive) return;
  window.__webclawActive = false;

  // =============================================
  // State
  // =============================================

  let ws = null;
  let audioContext = null;
  let playbackContext = null;
  let mediaStream = null;
  let processor = null;
  let analyser = null;
  let analyserData = null;
  let playbackQueue = [];
  let isPlaying = false;
  let overlay = null;
  let currentAgent = 'site'; // 'site' or 'personal'
  let seamlessVoice = true;
  let isSpeaking = false;
  let silenceStart = 0;
  let avatarColor = '#FF4D4D';
  let showLimbs = true;
  let avatarCanvas = null;
  let avatarAnimFrame = 0;
  let avatarState = 'idle'; // idle, listening, speaking, thinking, acting
  let mouthOpenness = 0;
  let targetMouth = 0;

  // VAD settings
  const VAD_THRESHOLD = 0.01;
  const VAD_SILENCE_MS = 1500;

  // =============================================
  // Message Handling
  // =============================================

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'GET_STATUS':
        sendResponse({
          connected: window.__webclawActive,
          agent: currentAgent,
          seamless: seamlessVoice,
        });
        return true;

      case 'ACTIVATE':
        if (window.__webclawActive) {
          deactivate();
        } else {
          activate(msg);
        }
        sendResponse({ ok: true });
        return true;

      case 'TOGGLE':
        if (window.__webclawActive) deactivate();
        else {
          chrome.storage?.sync.get(null, (settings) => {
            activate(settings);
          });
        }
        sendResponse({ ok: true });
        return true;

      case 'SWITCH_AGENT':
        switchAgent(msg.agent);
        sendResponse({ ok: true });
        return true;

      case 'SWITCH_AGENT_TOGGLE':
        switchAgent(currentAgent === 'site' ? 'personal' : 'site');
        sendResponse({ ok: true });
        return true;

      case 'SEND_TEXT':
        sendText(msg.text);
        sendResponse({ ok: true });
        return true;

      case 'UPDATE_AVATAR':
        avatarColor = msg.avatarColor || avatarColor;
        showLimbs = msg.showLimbs ?? showLimbs;
        sendResponse({ ok: true });
        return true;

      case 'SETTINGS_UPDATED':
        if (msg.settings) {
          seamlessVoice = msg.settings.seamlessVoice ?? seamlessVoice;
          // Could reconnect gateway if URL changed
        }
        sendResponse({ ok: true });
        return true;
    }
  });

  // =============================================
  // Activation
  // =============================================

  function activate(config) {
    window.__webclawActive = true;
    avatarColor = config.avatarColor || '#FF4D4D';
    showLimbs = config.showLimbs ?? true;
    seamlessVoice = config.seamlessVoice ?? config.voiceMode ?? true;

    const gatewayUrl = config.gatewayUrl || 'http://localhost:8080';

    createOverlay();
    connectGateway(gatewayUrl, config.sendDom ?? true);

    // Seamless voice: auto-start mic
    if (seamlessVoice) {
      startSeamlessMic();
    }

    // If auto-activated (Personal Claw), fetch welcome config and speak it aloud
    if (config.autoActivate) {
      fetchAndSpeakWelcome(gatewayUrl);
    }

    notifyStatus();
  }

  /**
   * Fetch the site's welcome message from the gateway REST API
   * and speak it aloud using Web Speech API (TTS).
   */
  async function fetchAndSpeakWelcome(gatewayUrl) {
    const siteId = window.location.hostname.replace(/\./g, '_') || 'personal';
    try {
      const res = await fetch(`${gatewayUrl}/api/sites/${siteId}/welcome`);
      if (res.ok) {
        const data = await res.json();
        const welcomeMsg = data.welcome_message || "Hi! I'm here to help.";
        const personaName = data.persona_name || 'WebClaw';

        // Update panel title
        const titleEl = overlay?.querySelector('#wc-panel-title');
        if (titleEl) titleEl.textContent = personaName;

        // Add welcome message to chat
        addMessage('agent', welcomeMsg);

        // Speak the welcome message aloud using Web Speech API
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(welcomeMsg);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 0.8;

          // Set avatar to speaking while TTS plays
          setAvatarState('speaking');
          utterance.onend = () => {
            setAvatarState(seamlessVoice ? 'listening' : 'idle');
          };
          utterance.onerror = () => {
            setAvatarState(seamlessVoice ? 'listening' : 'idle');
          };

          // Small delay so UI renders first
          setTimeout(() => {
            window.speechSynthesis.speak(utterance);
          }, 800);
        }
      }
    } catch (e) {
      console.warn('[WebClaw] Could not fetch welcome config:', e);
    }
  }

  function deactivate() {
    window.__webclawActive = false;
    ws?.close();
    ws = null;
    stopMic();
    cancelAnimationFrame(avatarAnimFrame);
    overlay?.remove();
    overlay = null;
    avatarCanvas = null;
    notifyStatus();
  }

  // =============================================
  // Overlay UI
  // =============================================

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'webclaw-ext-overlay';
    overlay.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: none;
    `;

    overlay.innerHTML = `
      <div id="wc-chat-panel" style="
        width: 360px; background: white; border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        overflow: hidden; display: none; flex-direction: column;
        pointer-events: auto;
      ">
        <div style="background:#0A0A0F;color:white;padding:12px 16px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px">🦀</span>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;" id="wc-panel-title">WebClaw</div>
            <div style="font-size:11px;opacity:0.7;" id="wc-panel-status">Connected</div>
          </div>
          <div id="wc-agent-toggle" style="display:flex;gap:4px;background:rgba(255,255,255,0.1);border-radius:6px;padding:2px;">
            <button id="wc-pill-site" style="padding:4px 10px;border-radius:4px;border:none;font-size:11px;cursor:pointer;background:rgba(255,77,77,0.8);color:white;font-weight:500;">Site</button>
            <button id="wc-pill-personal" style="padding:4px 10px;border-radius:4px;border:none;font-size:11px;cursor:pointer;background:transparent;color:rgba(255,255,255,0.6);font-weight:500;">My Claw</button>
          </div>
          <button id="wc-close" style="background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:18px;padding:4px;">&times;</button>
        </div>
        <div id="wc-voice-bar" style="
          display:none; align-items:center; gap:8px; padding:8px 16px;
          background:rgba(0,229,204,0.08); font-size:12px; color:#00B8A3;
        ">
          <span style="display:inline-flex;gap:2px;align-items:flex-end;height:14px;">
            <span style="width:3px;height:4px;background:#00E5CC;border-radius:1px;animation:wcBar 0.6s ease infinite;"></span>
            <span style="width:3px;height:8px;background:#00E5CC;border-radius:1px;animation:wcBar 0.6s ease infinite 0.1s;"></span>
            <span style="width:3px;height:12px;background:#00E5CC;border-radius:1px;animation:wcBar 0.6s ease infinite 0.2s;"></span>
            <span style="width:3px;height:8px;background:#00E5CC;border-radius:1px;animation:wcBar 0.6s ease infinite 0.3s;"></span>
            <span style="width:3px;height:4px;background:#00E5CC;border-radius:1px;animation:wcBar 0.6s ease infinite 0.4s;"></span>
          </span>
          Listening... just speak naturally
        </div>
        <div id="wc-messages" style="flex:1;overflow-y:auto;padding:14px;min-height:180px;max-height:300px;font-size:14px;"></div>
        <div style="display:flex;border-top:1px solid #eee;padding:8px;gap:8px;align-items:center;">
          <input id="wc-input" type="text" placeholder="Type or speak..." style="flex:1;border:none;outline:none;padding:10px;font-size:14px;" />
          <button id="wc-send" style="width:36px;height:36px;border-radius:50%;border:none;background:${avatarColor};color:white;cursor:pointer;font-size:14px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
      <div id="wc-fab" style="
        width: 64px; height: 64px; border-radius: 50%;
        cursor: pointer; pointer-events: auto;
        position: relative;
      ">
        <canvas id="wc-avatar-canvas" width="128" height="128" style="width:64px;height:64px;border-radius:50%;"></canvas>
      </div>
    `;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes wcBar { 0%,100%{transform:scaleY(0.5)} 50%{transform:scaleY(1)} }
    `;
    document.head.appendChild(style);

    document.body.appendChild(overlay);

    // Cache canvas
    avatarCanvas = overlay.querySelector('#wc-avatar-canvas');
    startAvatarAnimation();

    // Event listeners
    overlay.querySelector('#wc-close').addEventListener('click', () => togglePanel(false));
    overlay.querySelector('#wc-fab').addEventListener('click', () => togglePanel());
    overlay.querySelector('#wc-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        sendText(e.target.value.trim());
        e.target.value = '';
      }
    });
    overlay.querySelector('#wc-send').addEventListener('click', () => {
      const input = overlay.querySelector('#wc-input');
      if (input.value.trim()) {
        sendText(input.value.trim());
        input.value = '';
      }
    });
    overlay.querySelector('#wc-pill-site').addEventListener('click', () => switchAgent('site'));
    overlay.querySelector('#wc-pill-personal').addEventListener('click', () => switchAgent('personal'));

    // Show voice bar if seamless
    if (seamlessVoice) {
      overlay.querySelector('#wc-voice-bar').style.display = 'flex';
    }
  }

  function togglePanel(forceState) {
    const panel = overlay?.querySelector('#wc-chat-panel');
    if (!panel) return;
    const isOpen = panel.style.display === 'flex';
    const newState = forceState !== undefined ? forceState : !isOpen;
    panel.style.display = newState ? 'flex' : 'none';
  }

  // =============================================
  // Agent Switching
  // =============================================

  function switchAgent(agent) {
    currentAgent = agent;
    const siteBtn = overlay?.querySelector('#wc-pill-site');
    const personalBtn = overlay?.querySelector('#wc-pill-personal');

    if (siteBtn && personalBtn) {
      if (agent === 'site') {
        siteBtn.style.background = 'rgba(255,77,77,0.8)';
        siteBtn.style.color = 'white';
        personalBtn.style.background = 'transparent';
        personalBtn.style.color = 'rgba(255,255,255,0.6)';
      } else {
        personalBtn.style.background = 'rgba(255,77,77,0.8)';
        personalBtn.style.color = 'white';
        siteBtn.style.background = 'transparent';
        siteBtn.style.color = 'rgba(255,255,255,0.6)';
      }
    }

    addMessage('system', `Switched to ${agent === 'personal' ? 'My Claw' : 'Site Agent'}`);

    // Notify popup
    chrome.runtime?.sendMessage({ type: 'AGENT_SWITCHED', agent }).catch(() => {});

    // Reconnect with new agent context
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'switch_agent',
        agent_type: agent,
      }));
    }
  }

  // =============================================
  // Gateway Connection
  // =============================================

  function connectGateway(gatewayUrl, sendDom) {
    const wsUrl = gatewayUrl.replace(/^http/, 'ws');
    const sessionId = 'ext_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const siteId = window.location.hostname.replace(/\./g, '_') || 'personal';

    ws = new WebSocket(`${wsUrl}/ws/${siteId}/${sessionId}`);

    ws.onopen = () => {
      addMessage('system', 'Connected to WebClaw');
      setAvatarState('idle');

      // Negotiate
      ws.send(JSON.stringify({
        type: 'negotiate',
        capabilities: {
          agent_type: currentAgent,
          can_capture_screenshots: true,
          can_execute_actions: true,
          has_mic_permission: true,
          has_cross_site_context: true,
          seamless_voice: seamlessVoice,
          preferences: {},
        },
      }));

      if (sendDom) {
        const snapshot = captureSimpleSnapshot();
        ws.send(JSON.stringify({ type: 'dom_snapshot', html: snapshot, url: window.location.href }));
      }

      notifyStatus();
    };

    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      // Binary frames = raw PCM audio from Gemini
      if (event.data instanceof ArrayBuffer) {
        playAudioChunk(event.data);
        return;
      }
      // Text frames = JSON events
      try {
        const msg = JSON.parse(event.data);
        handleGatewayEvent(msg);
      } catch {}
    };

    ws.onclose = () => {
      if (window.__webclawActive) {
        addMessage('system', 'Disconnected. Reconnecting...');
        setTimeout(() => {
          if (window.__webclawActive) connectGateway(gatewayUrl, sendDom);
        }, 3000);
      }
    };
  }

  function handleGatewayEvent(event) {
    // New google-genai SDK events are simple typed JSON:
    //   {"type": "gemini", "text": "..."}        - agent text / transcription
    //   {"type": "user", "text": "..."}           - user input transcription
    //   {"type": "tool_call", "name": "...", "args": {...}, "result": {...}}
    //   {"type": "turn_complete"}
    //   {"type": "interrupted"}
    //   {"type": "error", "error": "..."}
    //   {"type": "negotiate_ack", ...}
    // Audio comes as binary ArrayBuffer (handled in onmessage above).

    const eventType = event.type;

    if (eventType === 'error') {
      addMessage('error', `Connection issue: ${event.error || 'Unknown error'}`);
      setAvatarState('idle');
      return;
    }

    if (eventType === 'negotiate_ack') {
      const persona = event.persona?.name || 'WebClaw';
      addMessage('system', `Connected to ${persona}`);
      return;
    }

    if (eventType === 'gemini') {
      // Agent text / output transcription
      addMessage('agent', event.text);
      setAvatarState('speaking');
      setTimeout(() => setAvatarState(seamlessVoice ? 'listening' : 'idle'), 2000);
      chrome.runtime?.sendMessage({ type: 'AGENT_MESSAGE', text: event.text }).catch(() => {});
      checkVoiceSwitchCommand(event.text);
      return;
    }

    if (eventType === 'user') {
      // Input transcription — could display in chat as user message
      addMessage('user', event.text);
      return;
    }

    if (eventType === 'tool_call') {
      // DOM action from Gemini — execute it
      executeAction({ name: event.name, args: event.args });
      return;
    }

    if (eventType === 'turn_complete') {
      setAvatarState(seamlessVoice ? 'listening' : 'idle');
      return;
    }

    if (eventType === 'interrupted') {
      setAvatarState('listening');
      return;
    }
  }

  function checkVoiceSwitchCommand(text) {
    // Check if the agent recognized a switch command
    const lower = text.toLowerCase();
    if (lower.includes('switching to your personal') || lower.includes('switching to my claw')) {
      switchAgent('personal');
    } else if (lower.includes('switching to site') || lower.includes('switching back to the site')) {
      switchAgent('site');
    }
  }

  // =============================================
  // DOM Actions
  // =============================================

  function executeAction(call) {
    const args = call.args || {};
    const name = call.name;
    setAvatarState('acting');

    try {
      switch (name) {
        case 'click_element': {
          const el = findEl(args.selector);
          if (el) { el.click(); addMessage('action', `Clicked: ${args.selector}`); }
          break;
        }
        case 'type_text': {
          const el = findEl(args.selector);
          if (el) { if (args.clear_first) el.value = ''; el.value += args.text; el.dispatchEvent(new Event('input', {bubbles:true})); addMessage('action', `Typed into: ${args.selector}`); }
          break;
        }
        case 'scroll_to': {
          if (args.selector) {
            const el = findEl(args.selector);
            if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
          } else {
            window.scrollBy({top: args.direction === 'up' ? -300 : 300, behavior:'smooth'});
          }
          addMessage('action', `Scrolled ${args.selector || args.direction}`);
          break;
        }
        case 'navigate_to':
          addMessage('action', `Navigating to: ${args.url}`);
          window.location.href = args.url;
          break;
        case 'highlight_element': {
          const el = findEl(args.selector);
          if (el) highlightEl(el, args.message);
          break;
        }
        case 'read_page': {
          const el = findEl(args.selector) || document.body;
          const text = el.textContent?.trim().substring(0, 2000);
          ws?.send(JSON.stringify({ type: 'dom_result', result: { text } }));
          break;
        }
        case 'select_option': {
          const el = findEl(args.selector);
          if (el) { el.value = args.value; el.dispatchEvent(new Event('change', {bubbles:true})); }
          break;
        }
        case 'check_checkbox': {
          const el = findEl(args.selector);
          if (el) { el.checked = args.checked ?? true; el.dispatchEvent(new Event('change', {bubbles:true})); }
          break;
        }
      }
    } catch (e) {
      addMessage('error', `Action failed: ${e.message}`);
    }

    setTimeout(() => setAvatarState(seamlessVoice ? 'listening' : 'idle'), 1000);
  }

  // =============================================
  // Element Finding
  // =============================================

  function findEl(selector) {
    let el = document.querySelector(selector);
    if (el) return el;
    el = document.querySelector(`[aria-label="${selector}"]`);
    if (el) return el;
    for (const c of document.querySelectorAll('a, button, [role="button"], label, h1, h2, h3, input, select, textarea')) {
      if (c.textContent?.trim().toLowerCase().includes(selector.toLowerCase())) return c;
    }
    return null;
  }

  function highlightEl(el, message) {
    const rect = el.getBoundingClientRect();
    const hl = document.createElement('div');
    hl.style.cssText = `position:fixed;top:${rect.top-4}px;left:${rect.left-4}px;width:${rect.width+8}px;height:${rect.height+8}px;border:3px solid ${avatarColor};border-radius:8px;background:rgba(255,77,77,0.1);pointer-events:none;z-index:999998;transition:opacity 0.3s;`;
    if (message) {
      const tip = document.createElement('div');
      tip.style.cssText = 'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#333;color:white;padding:4px 10px;border-radius:6px;font-size:12px;white-space:nowrap;margin-bottom:6px;';
      tip.textContent = message;
      hl.appendChild(tip);
    }
    document.body.appendChild(hl);
    setTimeout(() => { hl.style.opacity = '0'; setTimeout(() => hl.remove(), 300); }, 3500);
    addMessage('action', `Highlighted: ${message || 'element'}`);
  }

  // =============================================
  // Chat Messages
  // =============================================

  function sendText(text) {
    addMessage('user', text);

    // Check for agent switch voice commands in text
    const lower = text.toLowerCase();
    if (lower.includes('switch to my') || lower.includes('use my claw') || lower.includes('my agent') || lower.includes('switch agent')) {
      switchAgent(currentAgent === 'site' ? 'personal' : 'site');
      return;
    }

    ws?.send(JSON.stringify({ type: 'text', text }));
  }

  function addMessage(role, text) {
    const container = overlay?.querySelector('#wc-messages');
    if (!container) return;
    const div = document.createElement('div');
    const colors = { user: avatarColor, agent: '#f0f0f0', system: '#fff3cd', action: '#d4edda', error: '#f8d7da' };
    const textColors = { user: 'white', agent: '#333', system: '#856404', action: '#155724', error: '#721c24' };
    div.style.cssText = `margin-bottom:8px;padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.4;background:${colors[role]||'#f0f0f0'};color:${textColors[role]||'#333'};${role==='user'?'margin-left:40px;text-align:right;':'margin-right:40px;'}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // =============================================
  // Seamless Voice (VAD-based)
  // =============================================

  async function startSeamlessMic() {
    try {
      audioContext = new AudioContext({ sampleRate: 16000 });
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const source = audioContext.createMediaStreamSource(mediaStream);

      // Analyser for VAD
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyserData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      // Processor for raw PCM
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const input = e.inputBuffer.getChannelData(0);

        // Calculate RMS for VAD
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);

        // Update mouth openness for avatar
        targetMouth = Math.min(1, rms * 30);

        // VAD logic
        const now = Date.now();
        if (rms > VAD_THRESHOLD) {
          if (!isSpeaking) {
            isSpeaking = true;
            setAvatarState('speaking');
          }
          silenceStart = now;
        } else if (isSpeaking && (now - silenceStart) > VAD_SILENCE_MS) {
          isSpeaking = false;
          setAvatarState('listening');
        }

        // Only send audio when speaking
        if (isSpeaking) {
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          ws.send(pcm16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setAvatarState('listening');

    } catch (e) {
      addMessage('error', 'Mic access denied. Enable microphone for seamless voice.');
      console.error('[WebClaw] Mic error:', e);
    }
  }

  function stopMic() {
    processor?.disconnect();
    mediaStream?.getTracks().forEach(t => t.stop());
    audioContext?.close();
    processor = null;
    mediaStream = null;
    audioContext = null;
    analyser = null;
    isSpeaking = false;
  }

  // =============================================
  // Audio Playback
  // =============================================

  function playAudioChunk(audioData) {
    // audioData can be an ArrayBuffer (binary WS frame) or a base64 string (legacy)
    if (!playbackContext) {
      playbackContext = new AudioContext({ sampleRate: 24000 });
    }

    let int16;
    if (audioData instanceof ArrayBuffer) {
      int16 = new Int16Array(audioData);
    } else if (typeof audioData === 'string') {
      // base64 fallback
      const binary = atob(audioData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      int16 = new Int16Array(bytes.buffer);
    } else {
      return;
    }

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x7FFF;

    playbackQueue.push(float32);
    if (!isPlaying) processPlaybackQueue();
  }

  function processPlaybackQueue() {
    if (playbackQueue.length === 0) {
      isPlaying = false;
      setAvatarState(seamlessVoice ? 'listening' : 'idle');
      return;
    }

    isPlaying = true;
    setAvatarState('speaking');
    const data = playbackQueue.shift();
    const ctx = playbackContext;
    const buffer = ctx.createBuffer(1, data.length, 24000);
    buffer.getChannelData(0).set(data);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => processPlaybackQueue();
    source.start();
  }

  // =============================================
  // Avatar Animation (Character with teardrop body)
  // =============================================

  let avBlinkTimer = 0;
  let avIsBlinking = false;
  let avPulsePhase = 0;
  let avBounceY = 0;

  function setAvatarState(state) {
    avatarState = state;
  }

  function startAvatarAnimation() {
    const canvas = avatarCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = 128; // Render at 2x for retina

    function animate() {
      avatarAnimFrame = requestAnimationFrame(animate);
      const now = performance.now();

      // Smooth mouth
      const mouthSmooth = 0.7;
      mouthOpenness = mouthOpenness * mouthSmooth + targetMouth * (1 - mouthSmooth);
      if (avatarState !== 'speaking') targetMouth = 0;

      // Blink
      avBlinkTimer++;
      if (!avIsBlinking && Math.random() < 0.005) { avIsBlinking = true; avBlinkTimer = 0; }
      if (avIsBlinking && avBlinkTimer > 8) avIsBlinking = false;

      // Pulse
      avPulsePhase += 0.05;

      // Bounce
      if (avatarState === 'speaking') avBounceY = Math.sin(now * 0.004) * 2;
      else if (avatarState === 'listening') avBounceY = Math.sin(now * 0.002) * 1;
      else avBounceY *= 0.95;

      // Draw
      ctx.clearRect(0, 0, s, s);

      // Circular background for chathead
      const bgGrad = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      bgGrad.addColorStop(0, darken(avatarColor, 0.25));
      bgGrad.addColorStop(0.85, darken(avatarColor, 0.35));
      bgGrad.addColorStop(1, darken(avatarColor, 0.45));
      ctx.beginPath();
      ctx.arc(s/2, s/2, s/2, 0, Math.PI * 2);
      ctx.fillStyle = bgGrad;
      ctx.fill();

      const cx = s / 2;
      const cy = s / 2 + avBounceY;
      const bh = s * 0.45;
      const bw = bh * 0.65;

      // Glow
      if (avatarState !== 'idle') {
        const glowColors = { listening: '0,229,204', speaking: '255,122,122', thinking: '255,184,0', acting: '255,107,53' };
        const gc = glowColors[avatarState] || '255,77,77';
        const ga = 0.2 + Math.sin(avPulsePhase) * 0.1;
        ctx.beginPath();
        ctx.arc(cx, cy, bw * 0.75 + Math.sin(avPulsePhase) * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${gc},${ga})`;
        ctx.fill();
      }

      // Teardrop body
      const top = cy - bh * 0.45;
      const bottom = cy + bh * 0.35;
      const baseR = bw * 0.48;

      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.bezierCurveTo(cx + bw * 0.1, top + bh * 0.12, cx + baseR + bw * 0.06, cy - bh * 0.04, cx + baseR, bottom - bh * 0.06);
      ctx.bezierCurveTo(cx + baseR * 0.8, bottom + bh * 0.015, cx + baseR * 0.3, bottom + bh * 0.03, cx, bottom + bh * 0.02);
      ctx.bezierCurveTo(cx - baseR * 0.3, bottom + bh * 0.03, cx - baseR * 0.8, bottom + bh * 0.015, cx - baseR, bottom - bh * 0.06);
      ctx.bezierCurveTo(cx - baseR - bw * 0.06, cy - bh * 0.04, cx - bw * 0.1, top + bh * 0.12, cx, top);
      ctx.closePath();

      const grad = ctx.createLinearGradient(cx, top, cx, bottom);
      grad.addColorStop(0, lighten(avatarColor, 0.15));
      grad.addColorStop(0.5, avatarColor);
      grad.addColorStop(1, darken(avatarColor, 0.15));
      ctx.fillStyle = grad;
      ctx.fill();

      // Highlight
      ctx.save();
      ctx.clip();
      const hlGrad = ctx.createRadialGradient(cx - bw * 0.15, cy - bh * 0.2, 0, cx - bw * 0.15, cy - bh * 0.2, bw * 0.5);
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
      hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hlGrad;
      ctx.fillRect(0, 0, s, s);
      ctx.restore();

      // Eyes
      const eyeY = cy + bh * 0.01;
      const eyeSpacing = bw * 0.22;
      const eyeR = bw * 0.11;
      const eyeH = avIsBlinking ? eyeR * 0.12 : eyeR;

      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.ellipse(cx - eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2); ctx.fill();

      if (!avIsBlinking) {
        const px = Math.sin(now * 0.001) * eyeR * 0.25;
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath(); ctx.arc(cx - eyeSpacing + px, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeSpacing + px, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(cx - eyeSpacing + px + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeSpacing + px + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
      }

      // Mouth
      const mouthY2 = cy + bh * 0.13;
      const mouthW2 = bw * 0.18;
      const mOpen = mouthOpenness * bh * 0.12;

      if (mOpen > 1) {
        ctx.fillStyle = darken(avatarColor, 0.35);
        ctx.beginPath();
        ctx.ellipse(cx, mouthY2, mouthW2, Math.max(mOpen, 2), 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(cx, mouthY2 - bh * 0.015, mouthW2, 0.15, Math.PI - 0.15);
        ctx.strokeStyle = darken(avatarColor, 0.3);
        ctx.lineWidth = Math.max(1.5, bw * 0.03);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Cheek blush when speaking
      if (avatarState === 'speaking' || avatarState === 'listening') {
        const ba = 0.12 + Math.sin(avPulsePhase * 0.5) * 0.04;
        ctx.fillStyle = `rgba(255,150,150,${ba})`;
        const br = bw * 0.08;
        ctx.beginPath(); ctx.ellipse(cx - eyeSpacing - bw * 0.04, mouthY2 - bh * 0.01, br, br * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + eyeSpacing + bw * 0.04, mouthY2 - bh * 0.01, br, br * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Listening indicator ring
      if (avatarState === 'listening') {
        ctx.beginPath();
        ctx.arc(cx, cy, bw * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,204,${0.3 + Math.sin(avPulsePhase) * 0.15})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    animate();
  }

  // =============================================
  // DOM Snapshot
  // =============================================

  function captureSimpleSnapshot() {
    const els = [];
    for (const el of document.querySelectorAll('h1,h2,h3,nav a,button,.btn,input,select,textarea,[role="button"],a[href]')) {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent?.trim().substring(0, 80);
      const attrs = [];
      if (el.id) attrs.push(`id="${el.id}"`);
      if (el.getAttribute('href')) attrs.push(`href="${el.getAttribute('href')}"`);
      if (el.getAttribute('placeholder')) attrs.push(`placeholder="${el.getAttribute('placeholder')}"`);
      if (el.getAttribute('aria-label')) attrs.push(`aria-label="${el.getAttribute('aria-label')}"`);
      if (el.getAttribute('type')) attrs.push(`type="${el.getAttribute('type')}"`);
      els.push(`<${tag} ${attrs.join(' ')}>${text}</${tag}>`);
    }
    return els.slice(0, 50).join('\n');
  }

  // =============================================
  // Status
  // =============================================

  function notifyStatus() {
    chrome.runtime?.sendMessage({
      type: 'AGENT_STATUS',
      connected: window.__webclawActive,
      agent: currentAgent,
      seamless: seamlessVoice,
    }).catch(() => {});
  }

  // =============================================
  // Color Utils
  // =============================================

  function hexToRgb(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    return [(num >> 16) & 0xFF, (num >> 8) & 0xFF, num & 0xFF];
  }

  function lighten(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    return `rgb(${Math.min(255, r + Math.round(255 * amt))},${Math.min(255, g + Math.round(255 * amt))},${Math.min(255, b + Math.round(255 * amt))})`;
  }

  function darken(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    return `rgb(${Math.max(0, r - Math.round(255 * amt))},${Math.max(0, g - Math.round(255 * amt))},${Math.max(0, b - Math.round(255 * amt))})`;
  }

  // =============================================
  // Auto-activate
  // =============================================

  chrome.storage?.sync.get({
    autoActivate: false,
    gatewayUrl: 'http://localhost:8080',
    seamlessVoice: true,
    sendDom: true,
    avatarColor: '#FF4D4D',
    showLimbs: true,
    defaultPersonal: false,
    voiceSwitch: true,
  }, (settings) => {
    if (settings.autoActivate) {
      currentAgent = settings.defaultPersonal ? 'personal' : 'site';
      activate(settings);
    }
  });
})();
