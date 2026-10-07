/**
 * WebClaw Elite Avatar - Reference Robot Version
 *
 * Features:
 * - Circular dark robotic avatar
 * - Cyan glowing outer ring
 * - White/silver rounded robot head
 * - Black glossy visor
 * - Large cyan eyes
 * - Automatic eye blinking
 * - Audio-reactive speaking
 * - Floating animation
 * - Listening / speaking / thinking / acting states
 * - Optional speech bubble
 */

export type AvatarState =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | 'acting';

export interface AvatarOptions {
  bodyColor?: string;
  eyeColor?: string;
  showSpeechBubble?: boolean;
  speechBubbleText?: string;
}

const DEFAULT_OPTIONS: AvatarOptions = {
  bodyColor: '#e2e8f0',
  eyeColor: '#00d9ff',
  showSpeechBubble: false,
  speechBubbleText: '',
};

const GLOW_COLORS: Record<AvatarState, string> = {
  idle: '#00d9ff',
  listening: '#00bfff',
  speaking: '#00d9ff',
  thinking: '#8b5cf6',
  acting: '#00d9ff',
};

export class Avatar {

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: AvatarState = 'idle';

  private animFrame: number = 0;

  private mouthOpenness: number = 0;
  private targetMouthOpenness: number = 0;

  private hoverY: number = 0;

  private size: number;

  private opts: AvatarOptions;

  private lastFrameTime: number = performance.now();

  // Speech bubble
  private bubbleOpacity: number = 0;
  private targetBubbleOpacity: number = 0;

  // Audio analyser
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array | null = null;

  // Blink
  private nextBlinkTime: number = performance.now() + 2500;
  private blinkStartTime: number = 0;
  private blinking: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    color: string = '#e2e8f0',
    size: number = 64,
    options?: Partial<AvatarOptions>
  ) {

    this.canvas = canvas;

    this.ctx = canvas.getContext('2d')!;

    this.size = size;

    this.opts = {
      ...DEFAULT_OPTIONS,
      bodyColor: color,
      ...options
    };

    canvas.width = size;
    canvas.height = size;

    this.startAnimation();
  }

  // ============================================================
  // STATE
  // ============================================================

  setState(state: AvatarState): void {
    this.state = state;
  }

  // ============================================================
  // OPTIONS
  // ============================================================

  setOptions(opts: Partial<AvatarOptions>): void {
    this.opts = {
      ...this.opts,
      ...opts
    };
  }

  // ============================================================
  // SPEECH BUBBLE
  // ============================================================

  showBubble(text: string): void {

    this.opts.speechBubbleText = text;

    this.opts.showSpeechBubble = true;

    this.targetBubbleOpacity = 1;

    setTimeout(() => {
      this.hideBubble();
    }, 4000);
  }

  hideBubble(): void {

    this.targetBubbleOpacity = 0;

    setTimeout(() => {

      if (this.bubbleOpacity < 0.05) {
        this.opts.showSpeechBubble = false;
      }

    }, 300);
  }

  // ============================================================
  // AUDIO
  // ============================================================

  connectAudio(
    audioContext: AudioContext,
    sourceNode: AudioNode
  ): void {

    this.analyser = audioContext.createAnalyser();

    this.analyser.fftSize = 256;

    this.analyserData =
      new Uint8Array(
        this.analyser.frequencyBinCount
      );

    sourceNode.connect(this.analyser);
  }

  // ============================================================
  // MOUTH
  // ============================================================

  setMouthTarget(openness: number): void {

    this.targetMouthOpenness =
      Math.max(
        0,
        Math.min(1, openness)
      );
  }

  // ============================================================
  // START ANIMATION
  // ============================================================

  private startAnimation(): void {

    const animate = () => {

      this.animFrame =
        requestAnimationFrame(animate);

      this.update();

      this.draw();
    };

    this.animFrame =
      requestAnimationFrame(animate);
  }

  // ============================================================
  // UPDATE
  // ============================================================

  private update(): void {

    const now = performance.now();

    const dt =
      (now - this.lastFrameTime) / 16.67;

    this.lastFrameTime = now;

    // ----------------------------------------------------------
    // Smooth mouth movement
    // ----------------------------------------------------------

    const smoothSpeed =
      Math.pow(0.7, dt);

    this.mouthOpenness =
      this.mouthOpenness * smoothSpeed +
      this.targetMouthOpenness *
      (1 - smoothSpeed);

    // ----------------------------------------------------------
    // Audio reactive mouth
    // ----------------------------------------------------------

    if (
      this.analyser &&
      this.analyserData &&
      this.state === 'speaking'
    ) {

      this.analyser.getByteFrequencyData(
        this.analyserData as Uint8Array<ArrayBuffer>
      );

      let sum = 0;

      const count =
        Math.min(
          16,
          this.analyserData.length
        );

      for (
        let i = 0;
        i < count;
        i++
      ) {
        sum += this.analyserData[i];
      }

      this.targetMouthOpenness =
        Math.min(
          1,
          (sum / count / 255) * 1.8
        );
    }

    // ----------------------------------------------------------
    // Speaking without audio analyser
    // ----------------------------------------------------------

    if (
      this.state === 'speaking' &&
      !this.analyser
    ) {

      this.targetMouthOpenness =
        0.25 +
        Math.sin(now * 0.018) * 0.35;

    } else if (
      this.state !== 'speaking'
    ) {

      this.targetMouthOpenness = 0;
    }

    // ----------------------------------------------------------
    // Floating movement
    // ----------------------------------------------------------

    this.hoverY =
      Math.sin(now * 0.002) *
      (this.size * 0.018);

    // ----------------------------------------------------------
    // Speech bubble
    // ----------------------------------------------------------

    this.bubbleOpacity +=
      (
        this.targetBubbleOpacity -
        this.bubbleOpacity
      ) * 0.15;

    // ----------------------------------------------------------
    // Blink
    // ----------------------------------------------------------

    this.updateBlink(now);
  }

  // ============================================================
  // BLINK SYSTEM
  // ============================================================

  private updateBlink(now: number): void {

    // Start a blink
    if (
      !this.blinking &&
      now >= this.nextBlinkTime
    ) {

      this.blinking = true;

      this.blinkStartTime = now;
    }

    // Blink lasts approximately 180ms
    if (
      this.blinking &&
      now - this.blinkStartTime >= 180
    ) {

      this.blinking = false;

      // Random next blink
      this.nextBlinkTime =
        now +
        2200 +
        Math.random() * 3500;
    }
  }

  // ============================================================
  // GET EYE OPENNESS
  // ============================================================

  private getEyeOpenness(
    now: number
  ): number {

    if (!this.blinking) {
      return 1;
    }

    const elapsed =
      now - this.blinkStartTime;

    const duration = 180;

    const progress =
      elapsed / duration;

    /*
     * 0 → 0.5 = closing
     * 0.5 → 1 = opening
     */

    if (progress < 0.5) {

      return 1 -
        progress * 2;

    } else {

      return (
        progress - 0.5
      ) * 2;
    }
  }

  // ============================================================
  // DRAW
  // ============================================================

  private draw(): void {

    const ctx = this.ctx;

    const s = this.size;

    ctx.clearRect(
      0,
      0,
      s,
      s
    );

    const now =
      performance.now();

    const cx =
      s / 2;

    const cy =
      s / 2 +
      this.hoverY;

    const glowColor =
      GLOW_COLORS[this.state] ||
      '#00d9ff';

    // ==========================================================
    // 1. OUTER DARK CIRCLE
    // ==========================================================

    const outerRadius =
      s * 0.465;

    const outerGradient =
      ctx.createRadialGradient(
        cx,
        cy,
        s * 0.05,
        cx,
        cy,
        outerRadius
      );

    outerGradient.addColorStop(
      0,
      '#17465a'
    );

    outerGradient.addColorStop(
      0.58,
      '#082b3d'
    );

    outerGradient.addColorStop(
      1,
      '#03131e'
    );

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      outerRadius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      outerGradient;

    ctx.fill();

    // ==========================================================
    // 2. OUTER CYAN GLOW
    // ==========================================================

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      s * 0.405,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle =
      glowColor;

    ctx.lineWidth =
      s * 0.018;

    ctx.shadowColor =
      glowColor;

    ctx.shadowBlur =
      s * 0.075;

    ctx.setLineDash([
      s * 0.20,
      s * 0.055
    ]);

    ctx.stroke();

    ctx.setLineDash([]);

    ctx.restore();

    // ==========================================================
    // 3. ROBOT HEAD
    // ==========================================================

    const headW =
      s * 0.70;

    const headH =
      s * 0.61;

    const headX =
      cx - headW / 2;

    const headY =
      cy - s * 0.285;

    const headGradient =
      ctx.createLinearGradient(
        headX,
        headY,
        headX + headW,
        headY + headH
      );

    headGradient.addColorStop(
      0,
      '#ffffff'
    );

    headGradient.addColorStop(
      0.45,
      '#f0f3f4'
    );

    headGradient.addColorStop(
      1,
      '#aab5ba'
    );

    ctx.beginPath();

    if (ctx.roundRect) {

      ctx.roundRect(
        headX,
        headY,
        headW,
        headH,
        s * 0.18
      );

    } else {

      ctx.rect(
        headX,
        headY,
        headW,
        headH
      );
    }

    ctx.fillStyle =
      headGradient;

    ctx.shadowColor =
      'rgba(0,0,0,0.32)';

    ctx.shadowBlur =
      s * 0.055;

    ctx.shadowOffsetY =
      s * 0.022;

    ctx.fill();

    ctx.shadowColor =
      'transparent';

    ctx.shadowBlur = 0;

    ctx.shadowOffsetY = 0;

    // ==========================================================
    // 4. HEAD TOP HIGHLIGHT
    // ==========================================================

    ctx.beginPath();

    ctx.arc(
      cx,
      headY + s * 0.12,
      headW * 0.35,
      Math.PI * 1.12,
      Math.PI * 1.88
    );

    ctx.strokeStyle =
      'rgba(255,255,255,0.85)';

    ctx.lineWidth =
      s * 0.018;

    ctx.stroke();

    // ==========================================================
    // 5. SIDE EAR MODULES
    // ==========================================================

    const earW =
      s * 0.078;

    const earH =
      s * 0.205;

    ctx.fillStyle =
      '#e7ecee';

    ctx.strokeStyle =
      glowColor;

    ctx.lineWidth =
      s * 0.007;

    // LEFT

    ctx.beginPath();

    if (ctx.roundRect) {

      ctx.roundRect(
        headX - earW * 0.62,
        cy - earH / 2,
        earW,
        earH,
        earW * 0.45
      );

    } else {

      ctx.rect(
        headX - earW * 0.62,
        cy - earH / 2,
        earW,
        earH
      );
    }

    ctx.fill();

    ctx.stroke();

    // RIGHT

    ctx.beginPath();

    if (ctx.roundRect) {

      ctx.roundRect(
        headX + headW - earW * 0.38,
        cy - earH / 2,
        earW,
        earH,
        earW * 0.45
      );

    } else {

      ctx.rect(
        headX + headW - earW * 0.38,
        cy - earH / 2,
        earW,
        earH
      );
    }

    ctx.fill();

    ctx.stroke();

    
    const visorW =
      s * 0.595;

    const visorH =
      s * 0.395;

    const visorX =
      cx - visorW / 2;

    const visorY =
      cy - s * 0.19;

    const visorGradient =
      ctx.createLinearGradient(
        visorX,
        visorY,
        visorX,
        visorY + visorH
      );

    visorGradient.addColorStop(
      0,
      '#172f40'
    );

    visorGradient.addColorStop(
      0.5,
      '#071722'
    );

    visorGradient.addColorStop(
      1,
      '#02080d'
    );

    ctx.save();

    ctx.beginPath();

    if (ctx.roundRect) {

      ctx.roundRect(
        visorX,
        visorY,
        visorW,
        visorH,
        s * 0.14
      );

    } else {

      ctx.rect(
        visorX,
        visorY,
        visorW,
        visorH
      );
    }

    ctx.fillStyle =
      visorGradient;

    ctx.fill();

    ctx.strokeStyle =
      'rgba(130,170,185,0.38)';

    ctx.lineWidth =
      s * 0.007;

    ctx.stroke();

    ctx.clip();

    // ==========================================================
    // 7. VISOR REFLECTION
    // ==========================================================

    const reflection =
      ctx.createLinearGradient(
        visorX,
        visorY,
        visorX + visorW * 0.5,
        visorY + visorH
      );

    reflection.addColorStop(
      0,
      'rgba(255,255,255,0.12)'
    );

    reflection.addColorStop(
      0.35,
      'rgba(255,255,255,0.035)'
    );

    reflection.addColorStop(
      1,
      'rgba(255,255,255,0)'
    );

    ctx.beginPath();

    ctx.moveTo(
      visorX,
      visorY
    );

    ctx.lineTo(
      visorX + visorW * 0.40,
      visorY
    );

    ctx.lineTo(
      visorX + visorW * 0.10,
      visorY + visorH
    );

    ctx.lineTo(
      visorX,
      visorY + visorH
    );

    ctx.closePath();

    ctx.fillStyle =
      reflection;

    ctx.fill();

    // ==========================================================
    // 8. EYES
    // ==========================================================

    const eyeOpen =
      this.getEyeOpenness(now);

    const eyeW =
      s * 0.105;

    const fullEyeH =
      s * 0.145;

    const eyeH =
      Math.max(
        1.2,
        fullEyeH * eyeOpen
      );

    const eyeY =
      cy - s * 0.005;

    const leftEyeX =
      cx - s * 0.185;

    const rightEyeX =
      cx + s * 0.185;

    const drawEye =
      (x: number) => {

        // ------------------------------------------
        // Glow
        // ------------------------------------------

        ctx.save();

        ctx.shadowColor =
          glowColor;

        ctx.shadowBlur =
          s * 0.045;

        ctx.beginPath();

        if (ctx.roundRect) {

          ctx.roundRect(
            x - eyeW / 2,
            eyeY - eyeH / 2,
            eyeW,
            eyeH,
            eyeW * 0.43
          );

        } else {

          ctx.ellipse(
            x,
            eyeY,
            eyeW / 2,
            eyeH / 2,
            0,
            0,
            Math.PI * 2
          );
        }

        ctx.fillStyle =
          glowColor;

        ctx.fill();

        ctx.restore();

        // ------------------------------------------
        // Inner bright eye
        // ------------------------------------------

        if (eyeOpen > 0.15) {

          ctx.beginPath();

          ctx.ellipse(
            x,
            eyeY,
            eyeW * 0.25,
            Math.max(
              1,
              eyeH * 0.31
            ),
            0,
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            '#45ebff';

          ctx.fill();

          // ----------------------------------------
          // White eye reflection
          // ----------------------------------------

          ctx.beginPath();

          ctx.arc(
            x + eyeW * 0.12,
            eyeY - eyeH * 0.20,
            s * 0.018,
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            '#ffffff';

          ctx.fill();
        }
      };

    drawEye(leftEyeX);

    drawEye(rightEyeX);
// ==========================================================
    // 9. MOUTH
    // ==========================================================

    const mouthOpen = this.mouthOpenness;

    if (mouthOpen > 0.05) {
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy + s * 0.10, // <--- Yahan 0.10 kar diya hai halka sa aur upar karne ke liye
        s * 0.055,
        Math.max(
          s * 0.015,
          mouthOpen * s * 0.055
        ),
        0,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = glowColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = s * 0.025;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.beginPath();
      ctx.arc(
        cx,
        cy + s * 0.10, // <--- Yahan bhi 0.10 kar diya
        s * 0.075,
        0.15 * Math.PI,
        0.85 * Math.PI
      );
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = s * 0.012;
      ctx.lineCap = 'round';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = s * 0.025;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // ==========================================================
    // 10. LOWER BODY
    // ==========================================================

    const bodyW =
      s * 0.37;

    const bodyH =
      s * 0.145;

    const bodyX =
      cx - bodyW / 2;

    const bodyY =
      cy + s * 0.285;

    const bodyGradient =
      ctx.createLinearGradient(
        bodyX,
        bodyY,
        bodyX + bodyW,
        bodyY + bodyH
      );

    bodyGradient.addColorStop(
      0,
      '#ffffff'
    );

    bodyGradient.addColorStop(
      0.55,
      '#e5eaec'
    );

    bodyGradient.addColorStop(
      1,
      '#9da9ae'
    );

    ctx.beginPath();

    if (ctx.roundRect) {

      ctx.roundRect(
        bodyX,
        bodyY,
        bodyW,
        bodyH,
        s * 0.06
      );

    } else {

      ctx.rect(
        bodyX,
        bodyY,
        bodyW,
        bodyH
      );
    }

    ctx.fillStyle =
      bodyGradient;

    ctx.fill();

    // ==========================================================
    // 11. CHEST LIGHT
    // ==========================================================

    ctx.beginPath();

    ctx.arc(
      cx,
      bodyY + bodyH * 0.52,
      s * 0.022,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      glowColor;

    ctx.shadowColor =
      glowColor;

    ctx.shadowBlur =
      s * 0.035;

    ctx.fill();

    ctx.shadowBlur = 0;

    // ==========================================================
    // 12. SPEECH BUBBLE
    // ==========================================================

    if (
      this.opts.showSpeechBubble &&
      this.bubbleOpacity > 0.01 &&
      s >= 100
    ) {

      this.drawSpeechBubble(
        ctx,
        cx,
        cy - outerRadius - 16
      );
    }
  }

  // ============================================================
  // SPEECH BUBBLE DRAW
  // ============================================================

  private drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    cx: number,
    topY: number
  ): void {

    const text =
      this.opts.speechBubbleText || '';

    if (!text) {
      return;
    }

    const fontSize =
      Math.max(
        10,
        this.size * 0.1
      );

    ctx.font =
      `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

    const metrics =
      ctx.measureText(text);

    const textW =
      metrics.width;

    const padX =
      fontSize * 0.6;

    const padY =
      fontSize * 0.4;

    const bubbleW =
      textW + padX * 2;

    const bubbleH =
      fontSize + padY * 2;

    const bubbleX =
      cx - bubbleW / 2;

    const bubbleY =
      topY - bubbleH - 6;

    ctx.globalAlpha =
      this.bubbleOpacity;

    // Bubble
    ctx.fillStyle =
      '#ffffff';

    ctx.shadowColor =
      'rgba(0,0,0,0.15)';

    ctx.shadowBlur = 10;

    ctx.shadowOffsetY = 2;

    roundRect(
      ctx,
      bubbleX,
      bubbleY,
      bubbleW,
      bubbleH,
      8
    );

    ctx.fill();

    ctx.shadowColor =
      'transparent';

    ctx.shadowBlur = 0;

    // Text
    ctx.fillStyle =
      '#1e293b';

    ctx.textAlign =
      'center';

    ctx.textBaseline =
      'middle';

    ctx.fillText(
      text,
      cx,
      bubbleY + bubbleH / 2
    );

    ctx.globalAlpha = 1;
  }

  // ============================================================
  // DESTROY
  // ============================================================

  destroy(): void {

    cancelAnimationFrame(
      this.animFrame
    );

    this.analyser?.disconnect();
  }

  // ============================================================
  // DISPOSE
  // ============================================================

  dispose(): void {

    this.destroy();
  }
}

// ================================================================
// ROUND RECT HELPER
// ================================================================

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {

  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.lineTo(
    x + w - r,
    y
  );

  ctx.arcTo(
    x + w,
    y,
    x + w,
    y + r,
    r
  );

  ctx.lineTo(
    x + w,
    y + h - r
  );

  ctx.arcTo(
    x + w,
    y + h,
    x + w - r,
    y + h,
    r
  );

  ctx.lineTo(
    x + r,
    y + h
  );

  ctx.arcTo(
    x,
    y + h,
    x,
    y + h - r,
    r
  );

  ctx.lineTo(
    x,
    y + r
  );

  ctx.arcTo(
    x,
    y,
    x + r,
    y,
    r
  );

  ctx.closePath();
}