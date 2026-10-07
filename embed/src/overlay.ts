/**
 * WebClaw Overlay
 * The round avatar component that appears on the website.
 * Uses Shadow DOM for complete style isolation.
 */

export type OverlayState = 'idle' | 'listening' | 'speaking' | 'executing' | 'thinking' | 'connecting';

export class Overlay {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private avatar: HTMLElement;
  private stateLabel: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: OverlayState = 'idle';
  private animationFrame: number = 0;
  private mouthOpenness = 0;
  private breathPhase = 0;

  // Callbacks
  public onMicToggle: ((active: boolean) => void) | null = null;
  private micActive = false;

  constructor() {
    // Create container in body
    this.container = document.createElement('div');
    this.container.id = 'webclaw-overlay';
    this.shadow = this.container.attachShadow({ mode: 'closed' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = this.getStyles();
    this.shadow.appendChild(style);

    // Build DOM
    const wrapper = document.createElement('div');
    wrapper.className = 'webclaw-wrapper';

    // Avatar circle
    this.avatar = document.createElement('div');
    this.avatar.className = 'webclaw-avatar';
    this.avatar.addEventListener('click', () => this.toggleMic());

    // Canvas for face rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = 120;
    this.canvas.height = 120;
    this.ctx = this.canvas.getContext('2d')!;
    this.avatar.appendChild(this.canvas);

    // State label
    this.stateLabel = document.createElement('div');
    this.stateLabel.className = 'webclaw-state';
    this.stateLabel.textContent = '';

    wrapper.appendChild(this.avatar);
    wrapper.appendChild(this.stateLabel);
    this.shadow.appendChild(wrapper);

    document.body.appendChild(this.container);

    // Start animation loop
    this.animate();
  }

  private getStyles(): string {
    return `
      .webclaw-wrapper {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
      }

      .webclaw-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        box-shadow: 0 4px 24px rgba(15, 52, 96, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .webclaw-avatar:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 32px rgba(15, 52, 96, 0.6);
      }

      .webclaw-avatar.listening {
        box-shadow: 0 0 0 4px rgba(74, 144, 217, 0.4), 0 4px 24px rgba(15, 52, 96, 0.4);
        animation: webclaw-listen-pulse 1.5s ease-in-out infinite;
      }

      .webclaw-avatar.speaking {
        box-shadow: 0 0 0 4px rgba(72, 199, 142, 0.4), 0 4px 24px rgba(15, 52, 96, 0.4);
      }

      .webclaw-avatar.executing {
        box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.4), 0 4px 24px rgba(15, 52, 96, 0.4);
      }

      .webclaw-avatar.thinking {
        box-shadow: 0 0 0 4px rgba(156, 136, 255, 0.3), 0 4px 24px rgba(15, 52, 96, 0.4);
        animation: webclaw-think-pulse 2s ease-in-out infinite;
      }

      .webclaw-avatar canvas {
        width: 60px;
        height: 60px;
      }

      .webclaw-state {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        color: #666;
        background: rgba(255,255,255,0.95);
        padding: 3px 10px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }

      .webclaw-state.visible {
        opacity: 1;
      }

      @keyframes webclaw-listen-pulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(74, 144, 217, 0.4), 0 4px 24px rgba(15, 52, 96, 0.4); }
        50% { box-shadow: 0 0 0 8px rgba(74, 144, 217, 0.2), 0 4px 24px rgba(15, 52, 96, 0.4); }
      }

      @keyframes webclaw-think-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
  }

  setState(state: OverlayState): void {
    this.state = state;
    this.avatar.className = `webclaw-avatar ${state}`;

    const labels: Record<OverlayState, string> = {
      idle: '',
      listening: '🎤 Listening...',
      speaking: '💬 Speaking...',
      executing: '⚡ Working...',
      thinking: '🤔 Thinking...',
      connecting: '🔗 Connecting...',
    };

    this.stateLabel.textContent = labels[state];
    this.stateLabel.className = `webclaw-state ${state !== 'idle' ? 'visible' : ''}`;
  }

  setMouthOpenness(value: number): void {
    this.mouthOpenness = Math.max(0, Math.min(1, value));
  }

  private toggleMic(): void {
    this.micActive = !this.micActive;
    this.onMicToggle?.(this.micActive);
    this.setState(this.micActive ? 'listening' : 'idle');
  }

  private animate(): void {
    this.breathPhase += 0.02;
    const ctx = this.ctx;
    const w = 120, h = 120;

    ctx.clearRect(0, 0, w, h);

    // Background circle
    ctx.beginPath();
    ctx.arc(60, 60, 58, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    const breathOffset = Math.sin(this.breathPhase) * 2;

    // Eyes
    const eyeY = 42 + breathOffset * 0.3;
    const eyeScale = this.state === 'listening' ? 1.1 : 1;

    // Left eye
    ctx.beginPath();
    ctx.ellipse(42, eyeY, 7 * eyeScale, 8 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4A90D9';
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.ellipse(78, eyeY, 7 * eyeScale, 8 * eyeScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4A90D9';
    ctx.fill();

    // Eye highlights
    ctx.beginPath();
    ctx.arc(45, eyeY - 2, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(81, eyeY - 2, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Mouth
    const mouthY = 72 + breathOffset * 0.5;
    const mouthOpen = this.state === 'speaking' ? this.mouthOpenness : 0;

    if (mouthOpen > 0.05) {
      // Open mouth (speaking)
      ctx.beginPath();
      ctx.ellipse(60, mouthY, 12, 4 + mouthOpen * 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
    } else {
      // Closed mouth (smile)
      ctx.beginPath();
      ctx.arc(60, mouthY - 4, 14, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = '#4A90D9';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Thinking indicator
    if (this.state === 'thinking') {
      const dots = 3;
      for (let i = 0; i < dots; i++) {
        const dotPhase = this.breathPhase * 3 + i * 0.8;
        const dotY = mouthY + Math.sin(dotPhase) * 4;
        ctx.beginPath();
        ctx.arc(48 + i * 12, dotY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(156, 136, 255, ${0.5 + Math.sin(dotPhase) * 0.5})`;
        ctx.fill();
      }
    }

    // Random blink
    if (Math.random() < 0.003) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(32, eyeY - 8, 22, 16);
      ctx.fillRect(68, eyeY - 8, 22, 16);
    }

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.container.remove();
  }
}
