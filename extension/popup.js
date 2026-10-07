// WebClaw Extension - Enhanced Popup Controller
// Handles chat, avatar design, settings, and agent switching

const DEFAULT_GATEWAY = 'http://localhost:8080';

// =============================================
// State
// =============================================

let currentAgent = 'site'; // 'site' or 'personal'
let avatarColor = '#FF4D4D';
let avatarAnimFrame = 0;

// =============================================
// Init
// =============================================

async function init() {
  const settings = await chrome.storage.sync.get({
    gatewayUrl: DEFAULT_GATEWAY,
    autoActivate: false,
    seamlessVoice: true,
    sendDom: true,
    voiceSwitch: true,
    defaultPersonal: false,
    avatarColor: '#FF4D4D',
    showLimbs: true,
    showBubbles: true,
  });

  // Apply settings to UI
  document.getElementById('gateway-url').value = settings.gatewayUrl;
  document.getElementById('auto-activate').checked = settings.autoActivate;
  document.getElementById('seamless-voice').checked = settings.seamlessVoice;
  document.getElementById('send-dom').checked = settings.sendDom;
  document.getElementById('voice-switch').checked = settings.voiceSwitch;
  document.getElementById('default-personal').checked = settings.defaultPersonal;
  document.getElementById('show-limbs').checked = settings.showLimbs;
  document.getElementById('show-bubbles').checked = settings.showBubbles;

  avatarColor = settings.avatarColor;

  // Set active color swatch
  document.querySelectorAll('#body-colors .color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === avatarColor);
  });

  // Check connection status
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
      updateStatus(response?.connected || false, response?.agent || 'site', response?.seamless || false);
    } catch {
      updateStatus(false);
    }
  }

  // Default agent
  if (settings.defaultPersonal) {
    switchAgent('personal');
  }

  // Start avatar animations
  drawPopupAvatar();
  drawDesignPreview();

  // Bind events
  bindEvents();
}

// =============================================
// Tab Navigation
// =============================================

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.panel}`)?.classList.add('active');

    // Refresh avatar preview when switching to avatar tab
    if (tab.dataset.panel === 'avatar') {
      drawDesignPreview();
    }
  });
});

// =============================================
// Connection & Status
// =============================================

function updateStatus(connected, agent = 'site', seamless = false) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const voiceIndicator = document.getElementById('voice-indicator');

  if (connected && seamless) {
    dot.className = 'status-dot listening';
    text.textContent = 'Listening...';
    voiceIndicator.style.display = 'flex';
  } else if (connected) {
    dot.className = 'status-dot connected';
    text.textContent = `Connected (${agent === 'personal' ? 'My Claw' : 'Site Agent'})`;
    voiceIndicator.style.display = 'none';
  } else {
    dot.className = 'status-dot disconnected';
    text.textContent = 'Not connected';
    voiceIndicator.style.display = 'none';
  }

  // Update agent pills
  if (agent) {
    currentAgent = agent;
    document.getElementById('pill-site').classList.toggle('active', agent === 'site');
    document.getElementById('pill-personal').classList.toggle('active', agent === 'personal');
  }
}

// =============================================
// Agent Switching
// =============================================

function switchAgent(agent) {
  currentAgent = agent;
  document.getElementById('pill-site').classList.toggle('active', agent === 'site');
  document.getElementById('pill-personal').classList.toggle('active', agent === 'personal');

  // Notify content script
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SWITCH_AGENT', agent });
    }
  });

  addChatMessage('system', `Switched to ${agent === 'personal' ? 'My Claw' : 'Site Agent'}`);
}

document.getElementById('pill-site')?.addEventListener('click', () => switchAgent('site'));
document.getElementById('pill-personal')?.addEventListener('click', () => switchAgent('personal'));

// =============================================
// Chat
// =============================================

function addChatMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msg.innerHTML = `
    <div class="bubble">${escapeHtml(text)}</div>
    <div class="time">${time}</div>
  `;

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  addChatMessage('user', text);
  input.value = '';

  // Check for agent switch commands
  const lower = text.toLowerCase();
  if (lower.includes('switch to my') || lower.includes('use my claw') || lower.includes('my agent')) {
    switchAgent('personal');
    return;
  }
  if (lower.includes('switch to site') || lower.includes('use site') || lower.includes('site agent')) {
    switchAgent('site');
    return;
  }

  // Send to content script → gateway
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SEND_TEXT', text, agent: currentAgent });
    }
  });
}

document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

document.getElementById('btn-send')?.addEventListener('click', sendMessage);

// Listen for messages from content script
chrome.runtime.onMessage?.addListener((msg) => {
  if (msg.type === 'AGENT_MESSAGE') {
    addChatMessage('agent', msg.text);
  }
  if (msg.type === 'AGENT_STATUS') {
    updateStatus(msg.connected, msg.agent, msg.seamless);
  }
  if (msg.type === 'AGENT_SWITCHED') {
    currentAgent = msg.agent;
    document.getElementById('pill-site').classList.toggle('active', msg.agent === 'site');
    document.getElementById('pill-personal').classList.toggle('active', msg.agent === 'personal');
    addChatMessage('system', `Switched to ${msg.agent === 'personal' ? 'My Claw' : 'Site Agent'}`);
  }
});

// =============================================
// Avatar Design
// =============================================

// Color swatch clicks
document.getElementById('body-colors')?.addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (swatch) {
    avatarColor = swatch.dataset.color;
    document.querySelectorAll('#body-colors .color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    drawDesignPreview();
  }
});

// Custom color picker
document.getElementById('custom-body-color')?.addEventListener('input', (e) => {
  avatarColor = e.target.value;
  document.querySelectorAll('#body-colors .color-swatch').forEach(s => s.classList.remove('active'));
  drawDesignPreview();
});

// Avatar style toggles
document.getElementById('show-limbs')?.addEventListener('change', drawDesignPreview);
document.getElementById('show-bubbles')?.addEventListener('change', drawDesignPreview);

// Save avatar
document.getElementById('btn-save-avatar')?.addEventListener('click', async () => {
  await chrome.storage.sync.set({
    avatarColor,
    showLimbs: document.getElementById('show-limbs').checked,
    showBubbles: document.getElementById('show-bubbles').checked,
  });

  // Notify content script
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'UPDATE_AVATAR',
        avatarColor,
        showLimbs: document.getElementById('show-limbs').checked,
        showBubbles: document.getElementById('show-bubbles').checked,
      });
    }
  });

  const btn = document.getElementById('btn-save-avatar');
  btn.textContent = 'Saved!';
  btn.style.background = '#00E676';
  setTimeout(() => {
    btn.textContent = 'Save Avatar Design';
    btn.style.background = '';
  }, 2000);
});

// =============================================
// Settings
// =============================================

function bindEvents() {
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage?.();
  });
}

async function saveSettings() {
  await chrome.storage.sync.set({
    gatewayUrl: document.getElementById('gateway-url').value || DEFAULT_GATEWAY,
    autoActivate: document.getElementById('auto-activate').checked,
    seamlessVoice: document.getElementById('seamless-voice').checked,
    sendDom: document.getElementById('send-dom').checked,
    voiceSwitch: document.getElementById('voice-switch').checked,
    defaultPersonal: document.getElementById('default-personal').checked,
  });

  const btn = document.getElementById('btn-save-settings');
  btn.textContent = 'Saved!';
  btn.style.background = '#00E676';
  setTimeout(() => {
    btn.textContent = 'Save';
    btn.style.background = '';
  }, 2000);

  // Notify content script of setting changes
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SETTINGS_UPDATED',
        settings: {
          gatewayUrl: document.getElementById('gateway-url').value || DEFAULT_GATEWAY,
          seamlessVoice: document.getElementById('seamless-voice').checked,
          sendDom: document.getElementById('send-dom').checked,
        },
      });
    }
  });
}

// =============================================
// Avatar Rendering (Mini version for popup header)
// =============================================

function drawPopupAvatar() {
  const canvas = document.getElementById('popup-avatar');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const s = 36;

  function animate() {
    avatarAnimFrame = requestAnimationFrame(animate);
    const now = performance.now();
    ctx.clearRect(0, 0, s, s);

    const cx = s / 2;
    const cy = s / 2 + Math.sin(now * 0.002) * 0.8;
    const bh = s * 0.6;
    const bw = bh * 0.65;

    // Teardrop body
    const top = cy - bh * 0.42;
    const bottom = cy + bh * 0.33;
    const baseR = bw * 0.45;

    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + bw * 0.1, top + bh * 0.1, cx + baseR + bw * 0.05, cy - bh * 0.03, cx + baseR, bottom - bh * 0.05);
    ctx.bezierCurveTo(cx + baseR * 0.7, bottom + bh * 0.01, cx + baseR * 0.3, bottom + bh * 0.02, cx, bottom + bh * 0.015);
    ctx.bezierCurveTo(cx - baseR * 0.3, bottom + bh * 0.02, cx - baseR * 0.7, bottom + bh * 0.01, cx - baseR, bottom - bh * 0.05);
    ctx.bezierCurveTo(cx - baseR - bw * 0.05, cy - bh * 0.03, cx - bw * 0.1, top + bh * 0.1, cx, top);
    ctx.closePath();

    const grad = ctx.createLinearGradient(cx, top, cx, bottom);
    grad.addColorStop(0, lightenHex(avatarColor, 0.15));
    grad.addColorStop(1, darkenHex(avatarColor, 0.15));
    ctx.fillStyle = grad;
    ctx.fill();

    // Eyes
    const eyeY = cy - bh * 0.04;
    const eyeSpacing = bw * 0.16;
    const eyeR = bw * 0.08;
    const blink = Math.sin(now * 0.005) > 0.98;
    const eyeH = blink ? 0.5 : eyeR;

    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.ellipse(cx - eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2); ctx.fill();

    if (!blink) {
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.arc(cx - eyeSpacing, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eyeSpacing, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Smile
    ctx.beginPath();
    ctx.arc(cx, cy + bh * 0.08, bw * 0.1, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  animate();
}

function drawDesignPreview() {
  const canvas = document.getElementById('avatar-design-preview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const s = 120;
  const showLimbs = document.getElementById('show-limbs')?.checked ?? true;

  cancelAnimationFrame(avatarAnimFrame);

  function animate() {
    avatarAnimFrame = requestAnimationFrame(animate);
    const now = performance.now();
    ctx.clearRect(0, 0, s, s);

    const cx = s / 2;
    const bounce = Math.sin(now * 0.002) * 2;
    const cy = (showLimbs ? s * 0.4 : s / 2) + bounce;
    const bh = showLimbs ? s * 0.48 : s * 0.65;
    const bw = bh * 0.7;

    // Glow
    const glowAlpha = 0.12 + Math.sin(now * 0.003) * 0.04;
    ctx.beginPath();
    ctx.arc(cx, cy, bw * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,77,77,${glowAlpha})`;
    ctx.fill();

    // Limbs (behind body)
    if (showLimbs) {
      const limbColor = '#3D2B1F';
      const lw = 2;
      ctx.strokeStyle = limbColor;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';

      const bodyBottom = cy + bh * 0.35;
      const bodyLeft = cx - bw * 0.4;
      const bodyRight = cx + bw * 0.4;
      const armY = cy + bh * 0.05;

      // Left arm
      ctx.beginPath();
      ctx.moveTo(bodyLeft, armY);
      ctx.quadraticCurveTo(bodyLeft - bw * 0.2, armY + bh * 0.15, bodyLeft - bw * 0.1, armY + bh * 0.25);
      ctx.stroke();

      // Right arm (hand on hip)
      ctx.beginPath();
      ctx.moveTo(bodyRight, armY);
      ctx.quadraticCurveTo(bodyRight + bw * 0.25, armY + bh * 0.08, bodyRight + bw * 0.12, bodyBottom - bh * 0.05);
      ctx.stroke();

      // Legs
      const legY = bodyBottom + bh * 0.02;
      const legLen = bh * 0.25;

      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.12, legY);
      ctx.lineTo(cx - bw * 0.18, legY + legLen);
      ctx.lineTo(cx - bw * 0.08, legY + legLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + bw * 0.12, legY);
      ctx.lineTo(cx + bw * 0.18, legY + legLen);
      ctx.lineTo(cx + bw * 0.28, legY + legLen);
      ctx.stroke();
    }

    // Body teardrop
    const top = cy - bh * 0.45;
    const bottom = cy + bh * 0.37;
    const baseR = bw * 0.48;

    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + bw * 0.12, top + bh * 0.12, cx + baseR + bw * 0.06, cy - bh * 0.04, cx + baseR, bottom - bh * 0.06);
    ctx.bezierCurveTo(cx + baseR * 0.8, bottom + bh * 0.015, cx + baseR * 0.3, bottom + bh * 0.03, cx, bottom + bh * 0.02);
    ctx.bezierCurveTo(cx - baseR * 0.3, bottom + bh * 0.03, cx - baseR * 0.8, bottom + bh * 0.015, cx - baseR, bottom - bh * 0.06);
    ctx.bezierCurveTo(cx - baseR - bw * 0.06, cy - bh * 0.04, cx - bw * 0.12, top + bh * 0.12, cx, top);
    ctx.closePath();

    const grad = ctx.createLinearGradient(cx, top, cx, bottom);
    grad.addColorStop(0, lightenHex(avatarColor, 0.15));
    grad.addColorStop(0.5, avatarColor);
    grad.addColorStop(1, darkenHex(avatarColor, 0.15));
    ctx.fillStyle = grad;
    ctx.fill();

    // Highlight
    ctx.save();
    ctx.clip();
    const hlGrad = ctx.createRadialGradient(cx - bw * 0.15, cy - bh * 0.2, 0, cx - bw * 0.15, cy - bh * 0.2, bw * 0.5);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - bw, cy - bh, bw * 2, bh * 2);
    ctx.restore();

    // Eyes
    const eyeY = cy + bh * 0.01;
    const eyeSpacing = bw * 0.22;
    const eyeR = bw * 0.11;
    const blink = Math.sin(now * 0.005) > 0.98;
    const eyeH = blink ? eyeR * 0.12 : eyeR;

    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.ellipse(cx - eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2); ctx.fill();

    if (!blink) {
      const px = Math.sin(now * 0.001) * eyeR * 0.3;
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.arc(cx - eyeSpacing + px, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eyeSpacing + px, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();

      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(cx - eyeSpacing + px + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + eyeSpacing + px + eyeR * 0.2, eyeY - eyeR * 0.2, eyeR * 0.18, 0, Math.PI * 2); ctx.fill();
    }

    // Mouth (smile + bounce animation for speaking sim)
    const mouthY = cy + bh * 0.13;
    const mouthW = bw * 0.18;
    const mouthOpen = Math.max(0, Math.sin(now * 0.008) * 0.3 + 0.1) * bh * 0.05;

    if (mouthOpen > 1.5) {
      ctx.fillStyle = darkenHex(avatarColor, 0.3);
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, mouthW, mouthOpen, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, mouthY - bh * 0.015, mouthW, 0.15, Math.PI - 0.15);
      ctx.strokeStyle = darkenHex(avatarColor, 0.3);
      ctx.lineWidth = Math.max(1.5, bw * 0.03);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  animate();
}

// =============================================
// Color Utils
// =============================================

function hexToRgb(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  return [(num >> 16) & 0xFF, (num >> 8) & 0xFF, num & 0xFF];
}

function lightenHex(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + Math.round(255 * amount))},${Math.min(255, g + Math.round(255 * amount))},${Math.min(255, b + Math.round(255 * amount))})`;
}

function darkenHex(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - Math.round(255 * amount))},${Math.max(0, g - Math.round(255 * amount))},${Math.max(0, b - Math.round(255 * amount))})`;
}

// =============================================
// Start
// =============================================

init();
