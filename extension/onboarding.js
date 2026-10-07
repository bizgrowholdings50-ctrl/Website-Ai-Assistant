// WebClaw Extension - Onboarding Controller

let currentStep = 0;
const totalSteps = 4;

// Mic test state
let micStream = null;
let audioContext = null;
let analyser = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let vizAnimFrame = 0;

// =============================================
// Step Navigation
// =============================================

function goToStep(step) {
  if (step < 0 || step >= totalSteps) return;

  // Hide current
  document.getElementById(`step-${currentStep}`)?.classList.remove('active');

  // Update dots
  const dots = document.querySelectorAll('.step-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('active');
    if (i < step) dot.classList.add('completed');
    else dot.classList.remove('completed');
  });
  dots[step]?.classList.add('active');

  // Show new
  currentStep = step;
  document.getElementById(`step-${currentStep}`)?.classList.add('active');
}

function nextStep() {
  saveCurrentStepSettings();
  goToStep(currentStep + 1);
}

function prevStep() {
  goToStep(currentStep - 1);
}

// Click on step dots
document.getElementById('step-nav')?.addEventListener('click', (e) => {
  const dot = e.target.closest('.step-dot');
  if (dot) {
    const step = parseInt(dot.dataset.step);
    if (!isNaN(step)) goToStep(step);
  }
});

// =============================================
// Step 1: Microphone
// =============================================

async function loadMicrophones() {
  try {
    // Need to request permission first to get device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    tempStream.getTracks().forEach(t => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === 'audioinput');
    const select = document.getElementById('mic-select');
    select.innerHTML = '';

    if (mics.length === 0) {
      select.innerHTML = '<option value="">No microphones found</option>';
      return;
    }

    mics.forEach((mic, i) => {
      const opt = document.createElement('option');
      opt.value = mic.deviceId;
      opt.textContent = mic.label || `Microphone ${i + 1}`;
      select.appendChild(opt);
    });

    setMicStatus('ready', 'Microphone ready. Click to test.');
  } catch (err) {
    console.error('Mic access error:', err);
    setMicStatus('error', 'Microphone access denied. Please allow access.');
  }
}

function setMicStatus(state, text) {
  const dot = document.getElementById('mic-dot');
  const statusText = document.getElementById('mic-status-text');
  dot.className = 'dot';
  if (state === 'active') dot.classList.add('active');
  if (state === 'error') dot.classList.add('error');
  statusText.textContent = text;
}

document.getElementById('mic-test-btn')?.addEventListener('click', async () => {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
});

async function startRecording() {
  const deviceId = document.getElementById('mic-select')?.value;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // MediaRecorder for playback test
    mediaRecorder = new MediaRecorder(micStream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start();

    isRecording = true;
    const btn = document.getElementById('mic-test-btn');
    btn.classList.add('recording');
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

    setMicStatus('active', 'Recording... Speak now!');
    startVisualization();

    // Auto-stop after 10 seconds
    setTimeout(() => {
      if (isRecording) stopRecording();
    }, 10000);

  } catch (err) {
    console.error('Recording error:', err);
    setMicStatus('error', 'Could not access microphone.');
  }
}

function stopRecording() {
  isRecording = false;
  mediaRecorder?.stop();
  micStream?.getTracks().forEach(t => t.stop());
  cancelAnimationFrame(vizAnimFrame);

  const btn = document.getElementById('mic-test-btn');
  btn.classList.remove('recording');
  btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;

  setMicStatus('ready', 'Recording complete. Play it back to check quality.');
  document.getElementById('playback-btn').disabled = false;

  audioContext?.close();
  audioContext = null;
  analyser = null;
}

function startVisualization() {
  const canvas = document.getElementById('mic-viz');
  const ctx = canvas.getContext('2d');
  const bufferLen = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLen);

  function draw() {
    vizAnimFrame = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = '#1A1A24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLen) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLen; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      const hue = (dataArray[i] / 255) * 30;
      ctx.fillStyle = `hsl(${hue}, 85%, ${50 + dataArray[i] / 5}%)`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
      x += barWidth;
    }
  }

  draw();
}

document.getElementById('playback-btn')?.addEventListener('click', () => {
  if (recordedChunks.length === 0) return;
  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();

  const btn = document.getElementById('playback-btn');
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg> Playing...`;
  audio.onended = () => {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play Back`;
  };
});

// =============================================
// Step 2: Import from OpenClaw (Directory Access API)
// =============================================

// Workspace files we look for (case-insensitive matching).
// Each entry: { icon, label, desc, storageKey }
const WORKSPACE_FILES = {
  'USER.md':      { icon: '👤', label: 'User Profile',     desc: 'Your identity, preferences, and personal context',   storageKey: 'openclaw_user' },
  'SOUL.md':      { icon: '🫀', label: 'Soul',             desc: 'Agent personality, tone, and behavioral core',       storageKey: 'openclaw_soul' },
  'IDENTITY.md':  { icon: '🪪', label: 'Identity',         desc: 'Agent name, role, and how it introduces itself',     storageKey: 'openclaw_identity' },
  'MEMORY.md':    { icon: '💭', label: 'Memory',           desc: 'Persistent memories and conversation context',       storageKey: 'openclaw_memory' },
  'SKILLS.md':    { icon: '🧠', label: 'Skills',           desc: 'Capabilities, commands, and learned behaviors',      storageKey: 'openclaw_skills' },
  'TOOLS.md':     { icon: '🔧', label: 'Tools',            desc: 'Available tools and integrations',                   storageKey: 'openclaw_tools' },
  'AGENTS.md':    { icon: '🤖', label: 'Agents',           desc: 'Sub-agents, delegation rules, and agent roster',     storageKey: 'openclaw_agents' },
  'KNOWLEDGE.md': { icon: '📚', label: 'Knowledge Base',   desc: 'Domain knowledge, FAQs, and reference material',     storageKey: 'openclaw_knowledge' },
  'PROMPTS.md':   { icon: '📝', label: 'Prompts',          desc: 'System prompts and instruction templates',           storageKey: 'openclaw_prompts' },
  'CONFIG.md':    { icon: '⚙️', label: 'Config',           desc: 'Runtime configuration and settings',                 storageKey: 'openclaw_config' },
};

// Also check for these JSON/YAML config files
const CONFIG_FILES = {
  'openclaw.json':  { icon: '⚙️', label: 'OpenClaw Config',  storageKey: 'openclaw_config_json' },
  'config.json':    { icon: '⚙️', label: 'Config (JSON)',     storageKey: 'openclaw_config_json' },
  'settings.json':  { icon: '⚙️', label: 'Settings',          storageKey: 'openclaw_settings_json' },
  'manifest.json':  { icon: '📋', label: 'Manifest',          storageKey: 'openclaw_manifest' },
  'soul.json':      { icon: '🫀', label: 'Soul (JSON)',       storageKey: 'openclaw_soul_json' },
  'persona.json':   { icon: '🎭', label: 'Persona',           storageKey: 'openclaw_persona_json' },
};

// Known sub-directories to scan (one level deep)
const WORKSPACE_DIRS = ['skills', 'tools', 'agents', 'knowledge', 'memory', 'prompts', 'personas', 'soul'];

// State
let dirHandle = null;   // FileSystemDirectoryHandle
let foundFiles = [];    // { fileName, icon, label, desc, storageKey, content, size, fromDir? }

// ── Open directory picker ────────────────────────────────
async function openDirectoryPicker() {
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    const folderName = dirHandle.name;

    // Show status
    const statusEl = document.getElementById('folder-status');
    const pathEl = document.getElementById('folder-path');
    statusEl.style.display = 'block';
    pathEl.innerHTML = `<span style="color:var(--teal);">&#10003;</span> <strong>${escapeHtml(folderName)}</strong> &mdash; scanning...`;

    // Scan the directory
    foundFiles = [];
    await scanDirectory(dirHandle, '');

    // Update path display
    pathEl.innerHTML = `<span style="color:var(--teal);">&#10003;</span> <strong>${escapeHtml(folderName)}</strong> &mdash; ${foundFiles.length} file${foundFiles.length !== 1 ? 's' : ''} found`;

    // Re-label the button
    const btn = document.getElementById('pick-directory-btn');
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      Change Folder...
    `;

    renderFoundFiles();
  } catch (err) {
    if (err.name === 'AbortError') return; // User cancelled
    console.error('[WebClaw] Directory picker error:', err);
    const pathEl = document.getElementById('folder-path');
    const statusEl = document.getElementById('folder-status');
    statusEl.style.display = 'block';
    pathEl.innerHTML = `<span style="color:var(--danger);">&#10007;</span> Could not open folder: ${escapeHtml(err.message)}`;
  }
}

// ── Scan directory for workspace files ───────────────────
async function scanDirectory(handle, prefix) {
  // Build a case-insensitive lookup of files we want
  const wantedMd = {};
  for (const [name, meta] of Object.entries(WORKSPACE_FILES)) {
    wantedMd[name.toLowerCase()] = { ...meta, fileName: name };
  }
  const wantedJson = {};
  for (const [name, meta] of Object.entries(CONFIG_FILES)) {
    wantedJson[name.toLowerCase()] = { ...meta, fileName: name };
  }

  const subdirs = [];

  for await (const [name, entry] of handle.entries()) {
    const nameLower = name.toLowerCase();

    if (entry.kind === 'file') {
      // Check workspace .md files
      const mdMeta = wantedMd[nameLower];
      if (mdMeta) {
        const content = await readFileHandle(entry);
        if (content !== null) {
          foundFiles.push({
            ...mdMeta,
            path: prefix ? `${prefix}/${name}` : name,
            content,
            size: content.length,
          });
        }
        continue;
      }

      // Check JSON/YAML config files
      const jsonMeta = wantedJson[nameLower];
      if (jsonMeta) {
        const content = await readFileHandle(entry);
        if (content !== null) {
          foundFiles.push({
            ...jsonMeta,
            path: prefix ? `${prefix}/${name}` : name,
            content,
            size: content.length,
          });
        }
        continue;
      }
    }

    // Track known sub-directories for deeper scan
    if (entry.kind === 'directory' && !prefix) {
      if (nameLower === 'workspace') {
        // Recurse into workspace/ subdir — files are usually here
        await scanDirectory(entry, name);
      } else if (WORKSPACE_DIRS.includes(nameLower)) {
        subdirs.push({ name, nameLower, entry });
      }
    }
  }

  // Scan known sub-directories (one level)
  for (const { name, nameLower, entry } of subdirs) {
    const dirFiles = await collectDirFiles(entry, name);
    if (dirFiles.length > 0) {
      // Find a matching workspace file to piggyback on, or create a directory entry
      const dirLabel = nameLower.charAt(0).toUpperCase() + nameLower.slice(1);
      const meta = WORKSPACE_FILES[`${nameLower.toUpperCase()}.md`]
        || WORKSPACE_FILES[`${dirLabel.toUpperCase()}.md`]
        || { icon: '📁', label: dirLabel, desc: `Contents of ${name}/`, storageKey: `openclaw_dir_${nameLower}` };

      foundFiles.push({
        icon: meta.icon,
        label: `${meta.label} (${dirFiles.length} files)`,
        desc: meta.desc || `Contents of ${name}/`,
        storageKey: `${meta.storageKey}_dir`,
        fileName: `${name}/`,
        path: `${name}/`,
        content: JSON.stringify(dirFiles, null, 2),
        size: dirFiles.reduce((s, f) => s + f.size, 0),
        isDirectory: true,
        dirFiles,
      });
    }
  }
}

// ── Read a single FileSystemFileHandle → text ────────────
async function readFileHandle(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (err) {
    console.warn(`[WebClaw] Could not read file:`, err);
    return null;
  }
}

// ── Collect all text files from a sub-directory (recurses into subdirs) ──
async function collectDirFiles(dirHandle, dirName) {
  const files = [];
  try {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'file') {
        const ext = name.split('.').pop().toLowerCase();
        if (['md', 'txt', 'json', 'yaml', 'yml', 'toml'].includes(ext)) {
          const content = await readFileHandle(entry);
          if (content !== null) {
            files.push({ name, path: `${dirName}/${name}`, content, size: content.length });
          }
        }
      } else if (entry.kind === 'directory') {
        const subFiles = await collectDirFiles(entry, `${dirName}/${name}`);
        files.push(...subFiles);
      }
    }
  } catch (err) {
    console.warn(`[WebClaw] Error scanning ${dirName}/:`, err);
  }
  return files;
}

// ── Render found files ───────────────────────────────────
function renderFoundFiles() {
  const card = document.getElementById('import-results-card');
  const container = document.getElementById('import-list-container');
  const importAllBtn = document.getElementById('import-all-btn');

  if (foundFiles.length === 0) {
    card.style.display = 'block';
    importAllBtn.style.display = 'none';
    container.innerHTML = `
      <div class="empty-state" style="padding:16px;">
        <div class="empty-icon">🤔</div>
        <p>No recognised OpenClaw workspace files found.<br>
        Try selecting a different folder.</p>
      </div>
    `;
    return;
  }

  card.style.display = 'block';
  importAllBtn.style.display = 'block';
  container.innerHTML = '';

  const ul = document.createElement('ul');
  ul.className = 'import-list';

  for (const item of foundFiles) {
    const li = document.createElement('li');
    const sizeStr = item.size > 1024
      ? `${(item.size / 1024).toFixed(1)} KB`
      : `${item.size} B`;

    li.innerHTML = `
      <div class="import-info">
        <div class="import-icon">${item.icon}</div>
        <div>
          <div class="import-name">${escapeHtml(item.label)}</div>
          <div class="import-desc">${escapeHtml(item.path)} &middot; ${sizeStr}</div>
        </div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.className = 'import-btn';
    btn.textContent = 'Import';
    btn.addEventListener('click', () => importSingleFile(item, btn));
    li.appendChild(btn);
    ul.appendChild(li);
  }

  container.appendChild(ul);
}

// ── Import a single workspace file ───────────────────────
async function importSingleFile(item, btn) {
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    let payload;
    if (item.isDirectory) {
      payload = item.dirFiles;
    } else {
      // Try JSON parse; fall back to raw text
      try {
        payload = JSON.parse(item.content);
      } catch {
        payload = { content: item.content, format: item.path.split('.').pop() };
      }
    }

    await chrome.storage.local.set({ [item.storageKey]: payload });
    btn.classList.add('imported');
    btn.textContent = 'Imported ✓';
    console.log(`[WebClaw] Imported ${item.storageKey} (${item.path})`);
  } catch (err) {
    console.error(`[WebClaw] Import failed for ${item.path}:`, err);
    btn.textContent = 'Failed';
    btn.disabled = false;
  }
}

// ── Import all found files ───────────────────────────────
async function importAll() {
  const btn = document.getElementById('import-all-btn');
  btn.textContent = 'Importing...';
  btn.disabled = true;

  const toStore = {};
  let count = 0;

  for (const item of foundFiles) {
    try {
      let payload;
      if (item.isDirectory) {
        payload = item.dirFiles;
      } else {
        try { payload = JSON.parse(item.content); }
        catch { payload = { content: item.content, format: item.path.split('.').pop() }; }
      }
      toStore[item.storageKey] = payload;
      count++;
    } catch (err) {
      console.error(`[WebClaw] Import failed for ${item.path}:`, err);
    }
  }

  if (count > 0) {
    await chrome.storage.local.set(toStore);
    await chrome.storage.sync.set({ openclawImported: true, openclawImportDate: Date.now() });
    console.log(`[WebClaw] Bulk imported ${count} items:`, Object.keys(toStore));
  }

  btn.textContent = `Imported ${count}/${foundFiles.length} ✓`;
  btn.style.background = 'var(--success)';
  btn.style.color = 'var(--bg-dark)';

  // Mark individual buttons
  document.querySelectorAll('#import-list-container .import-btn').forEach(b => {
    if (!b.classList.contains('imported')) {
      b.classList.add('imported');
      b.textContent = 'Imported ✓';
      b.disabled = true;
    }
  });
}

// ── Test OpenClaw Gateway connection ─────────────────────
async function testOpenClawGateway() {
  const url = document.getElementById('openclaw-gateway-url')?.value?.trim();
  const btn = document.getElementById('test-openclaw-btn');
  const result = document.getElementById('openclaw-test-result');

  if (!url) {
    result.textContent = 'Enter a URL first.';
    result.style.color = 'var(--text-muted)';
    result.style.display = 'block';
    return;
  }

  btn.textContent = 'Testing...';
  btn.disabled = true;
  result.style.display = 'block';

  try {
    // Try common health endpoints
    const endpoints = ['/health', '/api/health', '/status', '/'];
    let connected = false;

    for (const ep of endpoints) {
      try {
        const resp = await fetch(`${url.replace(/\/+$/, '')}${ep}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const body = await resp.json().catch(() => null);
          const version = body?.version || body?.v || '';
          result.textContent = `Connected! ${version ? `(v${version})` : ''}`;
          result.style.color = 'var(--success)';
          connected = true;

          // Save URL
          await chrome.storage.sync.set({ openclawGatewayUrl: url });
          break;
        }
      } catch { /* try next */ }
    }

    if (!connected) {
      result.textContent = 'Could not reach gateway. Check the URL.';
      result.style.color = 'var(--danger)';
    }
  } catch (err) {
    result.textContent = `Error: ${err.message}`;
    result.style.color = 'var(--danger)';
  }

  btn.textContent = 'Test Connection';
  btn.disabled = false;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =============================================
// Step 3: Gateway / BYOK Config
// =============================================

function switchConfigTab(tab) {
  document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));

  const tabBtn = document.querySelector(`.config-tab[data-config-tab="${tab}"]`);
  const panel = document.getElementById(`panel-${tab}`);
  tabBtn?.classList.add('active');
  panel?.classList.add('active');

  // Store preference
  chrome.storage?.sync.set({ configMode: tab });
}

async function testGateway() {
  const url = document.getElementById('gateway-url')?.value;
  const btn = document.getElementById('test-gateway-btn');
  const result = document.getElementById('gateway-test-result');

  btn.textContent = 'Testing...';
  btn.disabled = true;
  result.style.display = 'block';

  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      result.textContent = 'Connection successful!';
      result.style.color = '#00E676';
    } else {
      result.textContent = `Server responded with ${resp.status}`;
      result.style.color = '#FFB800';
    }
  } catch (err) {
    result.textContent = 'Could not reach gateway. Check the URL and ensure the server is running.';
    result.style.color = '#FF4757';
  }

  btn.textContent = 'Test Connection';
  btn.disabled = false;
}

function toggleKeyVisibility(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// BYOK provider change
document.getElementById('byok-provider')?.addEventListener('change', (e) => {
  const modelSelect = document.getElementById('byok-model');
  const provider = e.target.value;

  modelSelect.innerHTML = '';
  const models = {
    gemini: [
      ['gemini-2.5-flash-native-audio-preview-12-2025', 'Gemini 2.5 Flash Native Audio'],
      ['gemini-2.5-flash-native-audio-latest', 'Gemini 2.5 Flash Native Audio (Latest)'],
    ],
    openai: [
      ['gpt-4o-realtime', 'GPT-4o Realtime'],
      ['gpt-4o', 'GPT-4o'],
    ],
    anthropic: [
      ['claude-opus-4-6', 'Claude Opus 4.6'],
      ['claude-sonnet-4-6', 'Claude Sonnet 4.6'],
    ],
  };

  (models[provider] || []).forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    modelSelect.appendChild(opt);
  });
});

// =============================================
// Settings Persistence
// =============================================

function saveCurrentStepSettings() {
  const settings = {};

  // Step 0: Mic
  settings.preferredMic = document.getElementById('mic-select')?.value || '';
  settings.seamlessVoice = document.getElementById('seamless-toggle')?.checked ?? true;

  // Step 1: OpenClaw Gateway
  const openclawUrl = document.getElementById('openclaw-gateway-url')?.value?.trim();
  if (openclawUrl) settings.openclawGatewayUrl = openclawUrl;

  // Step 2: WebClaw Gateway
  settings.gatewayUrl = document.getElementById('gateway-url')?.value || 'http://localhost:8080';
  settings.gatewayApiKey = document.getElementById('gateway-api-key')?.value || '';
  settings.byokProvider = document.getElementById('byok-provider')?.value || 'gemini';
  settings.byokApiKey = document.getElementById('byok-api-key')?.value || '';
  settings.byokModel = document.getElementById('byok-model')?.value || '';
  settings.autoActivate = document.getElementById('auto-activate')?.checked ?? false;
  settings.sendDom = document.getElementById('send-dom')?.checked ?? true;

  chrome.storage?.sync.set(settings);
}

function loadSettings() {
  chrome.storage?.sync.get(null, (settings) => {
    if (settings.preferredMic) {
      const select = document.getElementById('mic-select');
      if (select) select.value = settings.preferredMic;
    }
    if (settings.seamlessVoice !== undefined) {
      document.getElementById('seamless-toggle').checked = settings.seamlessVoice;
    }
    if (settings.openclawGatewayUrl) {
      document.getElementById('openclaw-gateway-url').value = settings.openclawGatewayUrl;
    }
    if (settings.gatewayUrl) {
      document.getElementById('gateway-url').value = settings.gatewayUrl;
    }
    if (settings.autoActivate !== undefined) {
      document.getElementById('auto-activate').checked = settings.autoActivate;
    }
    if (settings.sendDom !== undefined) {
      document.getElementById('send-dom').checked = settings.sendDom;
    }
  });
}

// =============================================
// Finish
// =============================================

function finishSetup() {
  saveCurrentStepSettings();
  chrome.storage?.sync.set({ onboardingComplete: true });
  // Close onboarding tab
  window.close();
}

// =============================================
// Header Avatar Animation (simple teardrop character)
// =============================================

function drawHeaderAvatar() {
  const canvas = document.getElementById('header-avatar');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const s = 80;

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    ctx.clearRect(0, 0, s, s);

    const cx = s / 2;
    const cy = s / 2 + Math.sin(now * 0.002) * 1.5;
    const bh = s * 0.55;
    const bw = bh * 0.7;

    // Glow
    const glowAlpha = 0.1 + Math.sin(now * 0.003) * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, bw * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,77,77,${glowAlpha})`;
    ctx.fill();

    // Body teardrop
    const top = cy - bh * 0.45;
    const bottom = cy + bh * 0.35;
    const baseR = bw * 0.48;

    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + bw * 0.1, top + bh * 0.12, cx + baseR + bw * 0.06, cy - bh * 0.04, cx + baseR, bottom - bh * 0.06);
    ctx.bezierCurveTo(cx + baseR * 0.8, bottom + bh * 0.01, cx + baseR * 0.3, bottom + bh * 0.03, cx, bottom + bh * 0.02);
    ctx.bezierCurveTo(cx - baseR * 0.3, bottom + bh * 0.03, cx - baseR * 0.8, bottom + bh * 0.01, cx - baseR, bottom - bh * 0.06);
    ctx.bezierCurveTo(cx - baseR - bw * 0.06, cy - bh * 0.04, cx - bw * 0.1, top + bh * 0.12, cx, top);
    ctx.closePath();

    const grad = ctx.createLinearGradient(cx, top, cx, bottom);
    grad.addColorStop(0, '#FF7A7A');
    grad.addColorStop(0.5, '#FF4D4D');
    grad.addColorStop(1, '#CC2A2A');
    ctx.fillStyle = grad;
    ctx.fill();

    // Eyes
    const eyeY = cy - bh * 0.06;
    const eyeSpacing = bw * 0.2;
    const eyeR = bw * 0.1;
    const blink = Math.sin(now * 0.005) > 0.98;
    const eyeH = blink ? eyeR * 0.15 : eyeR;

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing, eyeY, eyeR, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!blink) {
      const px = Math.sin(now * 0.001) * eyeR * 0.3;
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing + px, eyeY, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing + px, eyeY, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing + px + eyeR * 0.15, eyeY - eyeR * 0.15, eyeR * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing + px + eyeR * 0.15, eyeY - eyeR * 0.15, eyeR * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smile
    const mouthY = cy + bh * 0.1;
    ctx.beginPath();
    ctx.arc(cx, mouthY - bh * 0.015, bw * 0.15, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = 'rgba(26,26,46,0.5)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  animate();
}

// =============================================
// Init — Wire up all event listeners (CSP-safe, no inline handlers)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // Navigation: next/prev buttons via data-action attributes
  document.querySelectorAll('[data-action="next"]').forEach(btn => {
    btn.addEventListener('click', () => nextStep());
  });
  document.querySelectorAll('[data-action="prev"]').forEach(btn => {
    btn.addEventListener('click', () => prevStep());
  });

  // Config tabs (gateway / byok)
  document.querySelectorAll('[data-config-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchConfigTab(btn.dataset.configTab));
  });

  // API key visibility toggles
  document.querySelectorAll('[data-toggle-key]').forEach(btn => {
    btn.addEventListener('click', () => toggleKeyVisibility(btn.dataset.toggleKey));
  });

  // Test Gateway button
  document.getElementById('test-gateway-btn')?.addEventListener('click', () => testGateway());

  // Directory picker (File System Access API)
  document.getElementById('pick-directory-btn')?.addEventListener('click', () => openDirectoryPicker());

  // Import all button
  document.getElementById('import-all-btn')?.addEventListener('click', () => importAll());

  // OpenClaw gateway test
  document.getElementById('test-openclaw-btn')?.addEventListener('click', () => testOpenClawGateway());

  // Finish button
  document.getElementById('finish-btn')?.addEventListener('click', () => finishSetup());

  // Boot
  loadMicrophones();
  loadSettings();
  drawHeaderAvatar();
});
