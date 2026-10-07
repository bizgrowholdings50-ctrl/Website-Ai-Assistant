/**
 * WebClaw Gateway Client
 * Handles WebSocket communication with the WebClaw Gateway.
 */

export interface GatewayMessage {
  type: string;
  [key: string]: unknown;
}

export type MessageHandler = (msg: GatewayMessage) => void;
export type AgentMode = 'site' | 'qa';

export interface PageLocation {
  url: string;
  title: string;
  sectionId: string;
  sectionLabel: string;
}

const MAX_QA_CONTEXT_CHARS = 24000;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private gatewayUrl: string;
  private siteId: string;
  private sessionId: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: number | null = null;
  private lastAudioLocationKey = '';
  private agentMode: AgentMode = 'site';
  private pendingConnectReject: ((reason?: unknown) => void) | null = null;

  constructor(gatewayUrl: string, siteId: string, sessionId?: string) {
    this.gatewayUrl = gatewayUrl.replace(/^http/, 'ws');
    this.siteId = siteId;
    this.sessionId = sessionId || this.generateSessionId();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setAgentMode(agentMode: AgentMode): Promise<void> {
    if (this.agentMode === agentMode) return Promise.resolve();

    this.agentMode = agentMode;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.pendingConnectReject?.(new Error('Connection replaced to change agent mode.'));
    this.pendingConnectReject = null;

    const previousSocket = this.ws;
    this.ws = null;
    if (previousSocket) {
      previousSocket.onclose = null;
      previousSocket.onerror = null;
      previousSocket.onmessage = null;
      previousSocket.onopen = null;
      previousSocket.close();
    }

    return this.connect();
  }

  private generateSessionId(): string {
    return 'wc_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  connect(): Promise<void> {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    return new Promise((resolve, reject) => {
      const url = `${this.gatewayUrl}/ws/${this.siteId}/${this.sessionId}?agent_mode=${this.agentMode}`;
      const socket = new WebSocket(url);
      this.ws = socket;
      this.pendingConnectReject = reject;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.pendingConnectReject = null;
        this.reconnectAttempts = 0;
        this.lastAudioLocationKey = '';
        this.emit('connected', { type: 'connected' });
        resolve();
      };

      socket.binaryType = 'arraybuffer';

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        // Binary frames = raw PCM audio from Gemini
        if (event.data instanceof ArrayBuffer) {
          this.emit('audio', {
            type: 'audio',
            data: event.data,
            mimeType: 'audio/pcm;rate=24000',
          } as any);
          return;
        }
        // Text frames = JSON events
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[WebClaw] Failed to parse message:', e);
        }
      };

      socket.onclose = () => {
        if (this.ws !== socket) return;
        if (this.pendingConnectReject) {
          this.pendingConnectReject(new Error('Gateway WebSocket closed before connecting.'));
          this.pendingConnectReject = null;
        }
        this.emit('disconnected', { type: 'disconnected' });
        this.attemptReconnect();
      };

      socket.onerror = (err) => {
        if (this.ws !== socket) return;
        console.error('[WebClaw] WebSocket error:', err);
        this.pendingConnectReject = null;
        reject(err);
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  }

  private handleMessage(msg: any): void {
    // New google-genai SDK events are simple typed JSON objects:
    //   {"type": "user", "text": "..."}         - input transcription
    //   {"type": "gemini", "text": "..."}        - output transcription / text
    //   {"type": "tool_call", "name": "...", "args": {...}, "result": {...}}
    //   {"type": "turn_complete"}
    //   {"type": "interrupted"}
    //   {"type": "error", "error": "..."}
    //   {"type": "negotiate_ack", ...}
    // Audio comes as binary frames (handled in onmessage above).

    const eventType = msg.type;

    if (eventType === 'error') {
      console.error('[WebClaw] Gateway error:', msg.error, msg.details);
      this.emit('error', msg);
      return;
    }

    if (eventType === 'negotiate_ack') {
      this.emit('negotiate_ack', msg);
      return;
    }

    if (eventType === 'gemini') {
      // Agent text from model_turn (direct text response)
      console.log('[WebClaw] Received gemini text:', msg.text?.substring(0, 100));
      this.emit('text', { type: 'text', text: msg.text });
      return;
    }

    if (eventType === 'output_transcription') {
      // Audio transcription — only show if no direct text was received recently
      console.log('[WebClaw] Received output transcription:', msg.text?.substring(0, 100));
      this.emit('transcription', { type: 'transcription', text: msg.text });
      return;
    }

    if (eventType === 'user') {
      // Input transcription
      console.log('[WebClaw] Input transcription:', msg.text?.substring(0, 100));
      this.emit('input_transcription', { type: 'input_transcription', text: msg.text });
      return;
    }

    if (eventType === 'tool_call') {
      // DOM action from Gemini — call_id is used to match the result back
      console.log('[WebClaw] Tool call:', msg.name, msg.args, 'call_id:', msg.call_id);
      this.emit('action', {
        type: 'action',
        action: msg.name,
        args: msg.args,
        call_id: msg.call_id || msg.name,
      });
      return;
    }

    if (eventType === 'turn_complete') {
      this.emit('turn_complete', { type: 'turn_complete' });
      return;
    }

    if (eventType === 'interrupted') {
      this.emit('interrupted', { type: 'interrupted' });
      return;
    }

    // Also emit raw event for custom handling
    this.emit('raw', msg);
  }

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  private emit(event: string, msg: GatewayMessage): void {
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      try { handler(msg); } catch (e) { console.error('[WebClaw] Handler error:', e); }
    }
  }

  sendText(text: string, location?: PageLocation, qaContext = ''): void {
    this.send({
      type: 'text',
      text,
      location,
      ...(this.agentMode === 'qa' ? { qa_context: qaContext.slice(0, MAX_QA_CONTEXT_CHARS) } : {}),
      agent_mode: this.agentMode,
    });
  }

  sendDomSnapshot(html: string, url: string): void {
    this.send({ type: 'dom_snapshot', html, url });
  }

  sendQaSiteContext(content: string): void {
    if (this.agentMode === 'qa') {
      if (content.length > MAX_QA_CONTEXT_CHARS) {
        console.warn('[WebClaw] Trimming oversized Q&A website context before sending.');
      }
      this.send({
        type: 'qa_context',
        content: content.slice(0, MAX_QA_CONTEXT_CHARS),
      });
    }
  }

  sendActionResult(callId: string, result: unknown): void {
    this.send({ type: 'dom_result', call_id: callId, action_id: callId, result });
  }

  sendAudio(audioData: ArrayBuffer, location?: PageLocation): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (location) {
        const locationKey = JSON.stringify(location);
        if (locationKey !== this.lastAudioLocationKey) {
          this.send({
            type: 'audio_context',
            location,
            agent_mode: this.agentMode,
          });
          this.lastAudioLocationKey = locationKey;
        }
      }
      this.ws.send(audioData);
    }
  }

  sendImage(base64Data: string, mimeType: string = 'image/jpeg'): void {
    this.send({ type: 'image', data: base64Data, mimeType });
  }

  sendScreenshot(base64Data: string, url: string, prompt?: string): void {
    this.send({ type: 'screenshot', data: base64Data, mimeType: 'image/jpeg', url, prompt });
  }

  sendNegotiate(capabilities: Record<string, unknown>): void {
    this.send({ type: 'negotiate', capabilities });
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...data, agent_mode: this.agentMode }));
    }
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnect
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
  }
}
