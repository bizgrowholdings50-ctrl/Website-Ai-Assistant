/**
 * WebClaw Gateway Client
 * Handles WebSocket communication with the WebClaw Gateway.
 */

export interface GatewayMessage {
  type: string;
  [key: string]: unknown;
}

export type MessageHandler = (msg: GatewayMessage) => void;

export interface PageLocation {
  url: string;
  title: string;
  sectionId: string;
  sectionLabel: string;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private gatewayUrl: string;
  private siteId: string;
  private sessionId: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private lastAudioLocationKey = '';

  constructor(gatewayUrl: string, siteId: string) {
    this.gatewayUrl = gatewayUrl.replace(/^http/, 'ws');
    this.siteId = siteId;
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return 'wc_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.gatewayUrl}/ws/${this.siteId}/${this.sessionId}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.lastAudioLocationKey = '';
        this.emit('connected', { type: 'connected' });
        resolve();
      };

      this.ws.binaryType = 'arraybuffer';

      this.ws.onmessage = (event) => {
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

      this.ws.onclose = () => {
        this.emit('disconnected', { type: 'disconnected' });
        this.attemptReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[WebClaw] WebSocket error:', err);
        reject(err);
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    setTimeout(() => this.connect().catch(() => {}), delay);
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

  sendText(text: string, location?: PageLocation): void {
    this.send({ type: 'text', text, location });
  }

  sendDomSnapshot(html: string, url: string): void {
    this.send({ type: 'dom_snapshot', html, url });
  }

  sendActionResult(callId: string, result: unknown): void {
    this.send({ type: 'dom_result', call_id: callId, action_id: callId, result });
  }

  sendAudio(audioData: ArrayBuffer, location?: PageLocation): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (location) {
        const locationKey = JSON.stringify(location);
        if (locationKey !== this.lastAudioLocationKey) {
          this.send({ type: 'audio_context', location });
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

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnect
    this.ws?.close();
  }
}
