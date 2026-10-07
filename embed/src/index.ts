/**
 * WebClaw Embed Script
 * Drop-in <script> tag for any website to add a live AI agent.
 * Now with seamless voice (VAD), character avatar, and agent switching.
 *
 * Usage:
 *   <script src="https://gateway.webclaw.dev/embed.js"
 *           data-site-id="YOUR_SITE_ID"
 *           data-gateway="https://gateway.webclaw.dev">
 *   </script>
 */

import { GatewayClient, PageLocation } from './gateway-client';
import { AudioHandler } from './audio';
import { Avatar, AvatarState } from './avatar';
import { executeAction } from './dom-actions';
import { captureSnapshot } from './dom-snapshot';
import { animateToElement, cleanupVisualizerElements } from './action-visualizer';
import { captureScreenshot } from './screenshot';

// ========================================
// Configuration
// ========================================

interface WebClawConfig {
  siteId: string;
  gatewayUrl: string;
  position?: 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark';
  avatarColor?: string;
  seamless?: boolean;
}

function getConfig(): WebClawConfig {
  const script = document.currentScript as HTMLScriptElement
    || document.querySelector('script[data-site-id]');

  return {
    siteId: script?.getAttribute('data-site-id') || 'demo',
    gatewayUrl: script?.getAttribute('data-gateway') || 'http://localhost:8081',
    position: (script?.getAttribute('data-position') as any) || 'bottom-right',
    theme: (script?.getAttribute('data-theme') as any) || 'light',
    avatarColor: script?.getAttribute('data-color') || '#173B65',
    seamless: script?.getAttribute('data-seamless') !== 'false', // default true
  };
}

// ========================================
// Overlay UI (Web Component in Shadow DOM)
// ========================================

const OVERLAY_STYLES = `
  :host {
    all: initial;
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #17263b;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .webclaw-container {
    position: fixed;
    z-index: 999999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    --wc-navy: #173b65;
    --wc-navy-deep: #102d4d;
    --wc-accent: var(--wc-color, #173b65);
    --wc-ink: #17263b;
    --wc-muted: #718096;
    --wc-line: #e7edf4;
  }

  .webclaw-container.bottom-right {
    bottom: 24px;
    right: 24px;
  }

  .webclaw-container.bottom-left {
    bottom: 24px;
    left: 24px;
    align-items: flex-start;
  }

  .webclaw-panel {
    width: min(390px, calc(100vw - 32px));
    height: min(560px, calc(100vh - 112px));
    min-height: 360px;
    background: #fff;
    border: 1px solid rgba(220, 229, 239, 0.9);
    border-radius: 22px;
    box-shadow: 0 24px 64px rgba(16, 45, 77, 0.2), 0 4px 14px rgba(16, 45, 77, 0.08);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(14px) scale(0.97);
    transform-origin: bottom right;
    transition: opacity 220ms ease, transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), visibility 260ms;
    will-change: opacity, transform;
  }

  .webclaw-panel.open {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }

  .webclaw-panel-header {
    min-height: 82px;
    padding: 15px 18px;
    background: linear-gradient(135deg, #173b65 0%, #102d4d 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 3px 12px rgba(16, 45, 77, 0.13);
    position: relative;
    z-index: 1;
  }

  .webclaw-panel-header-content {
    display: flex;
    align-items: center;
    gap: 11px;
    flex: 1;
    min-width: 0;
  }

  .webclaw-avatar-frame {
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 3px rgba(255, 255, 255, 0.12);
  }

  .webclaw-header-copy {
    min-width: 0;
  }

  .webclaw-brand-label {
    display: block;
    margin-bottom: 3px;
    color: #b9cde2;
    font-size: 9px;
    font-weight: 750;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .webclaw-panel-header h3 {
    overflow: hidden;
    margin: 0;
    color: #fff;
    font-size: 15px;
    font-weight: 680;
    letter-spacing: -0.01em;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .webclaw-panel-header .status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    color: #d4e0ed;
    font-size: 11px;
  }

  .webclaw-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #67d6a2;
    box-shadow: 0 0 0 3px rgba(103, 214, 162, 0.14);
  }

  .webclaw-status-dot.connecting {
    background: #f4c66a;
    box-shadow: 0 0 0 3px rgba(244, 198, 106, 0.14);
    animation: webclaw-status-pulse 1.4s ease-in-out infinite;
  }

  .webclaw-status-dot.disconnected {
    background: #f08d8d;
    box-shadow: 0 0 0 3px rgba(240, 141, 141, 0.14);
  }

  .webclaw-status-dot.listening {
    background: #7bd5e3;
    box-shadow: 0 0 0 3px rgba(123, 213, 227, 0.14);
    animation: webclaw-status-pulse 1.1s ease-in-out infinite;
  }

  .webclaw-btn-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    cursor: pointer;
    transition: background 160ms ease, transform 160ms ease;
  }

  .webclaw-btn-close:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: rotate(4deg);
  }

  .webclaw-agent-switch {
    display: flex;
    flex: 0 0 auto;
    gap: 2px;
    padding: 3px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 10px;
    background: rgba(7, 25, 45, 0.24);
  }

  .webclaw-agent-pill {
    padding: 6px 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #c4d2e1;
    font-size: 10px;
    font-weight: 650;
    white-space: nowrap;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .webclaw-agent-pill.active {
    background: rgba(255, 255, 255, 0.17);
    color: #fff;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  }

  .webclaw-voice-bar {
    display: none;
    align-items: center;
    gap: 9px;
    padding: 9px 18px;
    border-bottom: 1px solid #dceef3;
    background: #f0f8fa;
    color: #276c7a;
    font-size: 11px;
    font-weight: 600;
  }

  .webclaw-voice-bar.active { display: flex; }

  .webclaw-voice-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 14px;
  }

  .webclaw-voice-bar-item {
    width: 3px;
    border-radius: 2px;
    background: #338da0;
    animation: webclaw-bar-pulse 0.65s ease-in-out infinite;
  }

  @keyframes webclaw-bar-pulse {
    0%, 100% { transform: scaleY(0.55); opacity: 0.7; }
    50% { transform: scaleY(1); opacity: 1; }
  }

  @keyframes webclaw-status-pulse {
    50% { opacity: 0.55; }
  }

  .webclaw-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 21px 18px 14px;
    background: linear-gradient(180deg, #f8fafd 0%, #fff 42%);
    overscroll-behavior: contain;
    scrollbar-color: #cbd6e2 transparent;
    scrollbar-width: thin;
  }

  .webclaw-messages::-webkit-scrollbar {
    width: 6px;
  }

  .webclaw-messages::-webkit-scrollbar-thumb {
    border-radius: 99px;
    background: #cbd6e2;
  }

  .webclaw-msg-wrapper {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 15px;
    animation: webclaw-message-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .webclaw-msg {
    max-width: 84%;
    padding: 11px 14px;
    border: 1px solid transparent;
    border-radius: 15px;
    font-size: 13px;
    line-height: 1.55;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .webclaw-msg.agent {
    align-self: flex-start;
    border-color: #e7edf4;
    border-bottom-left-radius: 5px;
    background: #fff;
    color: #26374c;
    box-shadow: 0 2px 7px rgba(23, 59, 101, 0.045);
  }

  .webclaw-msg.typing {
    border-color: #e7edf4;
    border-bottom-left-radius: 5px;
    background: #fff;
    color: #75849a;
    box-shadow: 0 2px 7px rgba(23, 59, 101, 0.045);
  }

  .webclaw-msg-wrapper.user .webclaw-msg-timestamp {
    align-self: flex-end;
  }

  .webclaw-msg.typing::after {
    display: inline-block;
    width: 1.2em;
    content: '...';
    animation: webclaw-typing 1.2s steps(3, end) infinite;
  }

  .webclaw-msg.user {
    align-self: flex-end;
    margin-left: auto;
    border-bottom-right-radius: 5px;
    background: var(--wc-accent);
    color: #fff;
    box-shadow: 0 4px 10px rgba(23, 59, 101, 0.16);
  }

  .webclaw-msg-timestamp {
    align-self: flex-start;
    padding: 0 5px;
    color: #8794a5;
    font-size: 10px;
    line-height: 1.2;
  }

  .webclaw-input-row {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0;
    padding: 13px 15px 15px;
    border-top: 1px solid var(--wc-line);
    background: #fff;
  }

  .webclaw-input-row input {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0 14px;
    border: 1px solid #e0e7ef;
    border-radius: 12px;
    outline: none;
    background: #f8fafd;
    color: var(--wc-ink);
    font: inherit;
    font-size: 13px;
    transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .webclaw-input-row input::placeholder {
    color: #8b98a9;
  }

  .webclaw-input-row input:focus {
    border-color: #7d9bbc;
    outline: none;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(49, 91, 138, 0.11);
  }

  .webclaw-btn-send {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border: 0;
    border-radius: 12px;
    background: var(--wc-accent);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(23, 59, 101, 0.17);
    transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .webclaw-btn-send:hover {
    transform: translateY(-1px);
    background: var(--wc-navy-deep);
    box-shadow: 0 6px 14px rgba(23, 59, 101, 0.22);
  }

  .webclaw-fab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    padding: 0;
    overflow: hidden;
    border: 3px solid #fff;
    border-radius: 50%;
    background: var(--wc-navy);
    cursor: pointer;
    box-shadow: 0 7px 22px rgba(16, 45, 77, 0.28), 0 0 0 1px rgba(23, 59, 101, 0.08);
    transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 200ms ease;
  }

  .webclaw-fab canvas {
    width: 58px !important;
    height: 58px !important;
    border-radius: 50%;
  }

  .webclaw-fab:focus-visible,
  .webclaw-btn-close:focus-visible,
  .webclaw-btn-send:focus-visible,
  .webclaw-agent-pill:focus-visible {
    outline: 3px solid #8db2d4;
    outline-offset: 3px;
  }

  .webclaw-fab:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 10px 28px rgba(16, 45, 77, 0.34), 0 0 0 1px rgba(23, 59, 101, 0.1);
  }

  .webclaw-container.bottom-left .webclaw-panel {
    transform-origin: bottom left;
  }

  .webclaw-container.bottom-left .webclaw-welcome-bubble {
    right: auto;
    left: 0;
  }

  .webclaw-container.bottom-left .webclaw-welcome-bubble::after {
    right: auto;
    left: 24px;
  }

  .webclaw-welcome-bubble {
    position: absolute;
    right: 0;
    bottom: 74px;
    z-index: 1;
    min-width: 160px;
    max-width: min(280px, calc(100vw - 40px));
    padding: 14px 17px;
    border: 1px solid #e5ebf2;
    border-radius: 15px;
    background: #fff;
    color: #3a4a60;
    font-size: 13px;
    line-height: 1.5;
    box-shadow: 0 12px 32px rgba(16, 45, 77, 0.16);
    opacity: 0;
    transform: translateY(8px) scale(0.97);
    transform-origin: bottom right;
    transition: opacity 220ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
  }

  .webclaw-welcome-bubble.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .webclaw-welcome-bubble::after {
    position: absolute;
    right: 24px;
    bottom: -6px;
    width: 11px;
    height: 11px;
    border-right: 1px solid #e5ebf2;
    border-bottom: 1px solid #e5ebf2;
    background: #fff;
    content: '';
    transform: rotate(45deg);
  }

  .webclaw-welcome-bubble .bubble-name {
    margin-bottom: 4px;
    color: var(--wc-navy);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.04em;
  }

  @keyframes webclaw-message-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes webclaw-typing {
    0%, 20% { opacity: 0.25; }
    50% { opacity: 1; }
    100% { opacity: 0.25; }
  }

  @media (max-width: 480px) {
    .webclaw-container.bottom-right {
      right: 16px;
      bottom: 16px;
    }

    .webclaw-container.bottom-left {
      left: 16px;
      bottom: 16px;
    }

    .webclaw-panel {
      width: min(390px, calc(100vw - 32px));
      height: min(560px, calc(100dvh - 104px));
      min-height: min(360px, calc(100dvh - 104px));
    }

    .webclaw-panel-header {
      gap: 8px;
      padding-right: 12px;
      padding-left: 14px;
    }

    .webclaw-agent-pill {
      padding-right: 7px;
      padding-left: 7px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// Global highlight animation
const GLOBAL_STYLE = document.createElement('style');
GLOBAL_STYLE.textContent = `
  @keyframes webclaw-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
document.head.appendChild(GLOBAL_STYLE);

// ========================================
// Main WebClaw Class
// ========================================

class WebClawEmbed {
  private config: WebClawConfig;
  private gateway: GatewayClient;
  private audio: AudioHandler;
  private shadow!: ShadowRoot;
  private panel!: HTMLElement;
  private messagesEl!: HTMLElement;
  private statusDot!: HTMLElement;
  private avatar: Avatar | null = null;
  private isOpen = false;
  private typingIndicator: HTMLElement | null = null;
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private currentAgent: 'site' | 'personal' = 'site';
  private voiceBarEl: HTMLElement | null = null;
  private welcomeMessage: string = '';
  private readonly brandName = 'BizGrow Holdings';
  private lastTextTime: number = 0;
  private activePageLocation: PageLocation = this.getPageLocation(null);

  constructor(config: WebClawConfig) {
    this.config = config;
    this.gateway = new GatewayClient(config.gatewayUrl, config.siteId);
    this.audio = new AudioHandler({ seamless: config.seamless ?? true });

    this.createUI();
    this.startContextTracking();
    this.bindGatewayEvents();
    this.bindAudioEvents();

    // Fetch welcome config and show bubble, then auto-connect to gateway
    this.initWelcomeAndConnect();
  }

  private getPageLocation(section: HTMLElement | null): PageLocation {
    const heading = section?.querySelector('h1, h2, h3, h4, h5, h6');
    return {
      url: `${window.location.origin}${window.location.pathname}`,
      title: document.title.slice(0, 200),
      sectionId: (section?.id || section?.dataset.contextSection || '').slice(0, 120),
      sectionLabel: (
        section?.getAttribute('aria-label')
        || heading?.textContent
        || section?.dataset.contextSection
        || section?.id.replace(/[-_]/g, ' ')
        || ''
      ).trim().slice(0, 200),
    };
  }

  private startContextTracking(): void {
    const updateLocation = (): void => {
      const viewportCenter = window.innerHeight * 0.45;
      const candidates = document.querySelectorAll<HTMLElement>(
        'main[id], section, article, .section[id], .features-section[id], [data-context-section]'
      );
      let activeSection: HTMLElement | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestArea = Number.POSITIVE_INFINITY;

      candidates.forEach((candidate) => {
        const rect = candidate.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;

        const containsCenter = rect.top <= viewportCenter && rect.bottom >= viewportCenter;
        const distance = containsCenter
          ? 0
          : Math.min(Math.abs(rect.top - viewportCenter), Math.abs(rect.bottom - viewportCenter));
        const area = rect.width * rect.height;
        if (
          distance < bestDistance
          || (distance === bestDistance && area < bestArea)
        ) {
          activeSection = candidate;
          bestDistance = distance;
          bestArea = area;
        }
      });

      this.activePageLocation = this.getPageLocation(activeSection);
    };

    let updateScheduled = false;
    const scheduleUpdate = (): void => {
      if (updateScheduled) return;
      updateScheduled = true;
      window.requestAnimationFrame(() => {
        updateScheduled = false;
        updateLocation();
      });
    };

    updateLocation();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    window.addEventListener('popstate', scheduleUpdate);
  }

  /**
   * Fetch welcome config from gateway REST API, show speech bubble on avatar,
   * and auto-connect the WebSocket so the agent is ready immediately.
   */
  private async initWelcomeAndConnect(): Promise<void> {
    // 1. Fetch welcome config from REST API
    try {
      const res = await fetch(
        `${this.config.gatewayUrl}/api/sites/${this.config.siteId}/welcome`
      );
      if (res.ok) {
        const data = await res.json();
        this.welcomeMessage = data.welcome_message || 'Hi! I\'m here to help.';
      }
    } catch (e) {
      console.warn('[WebClaw] Could not fetch welcome config, using defaults');
      this.welcomeMessage = 'Hi! I\'m here to help.';
    }

    // 2. Update the panel header with the persona name
    const headerTitle = this.shadow.querySelector('.webclaw-panel-header h3');
    if (headerTitle) headerTitle.textContent = this.brandName;

    // 3. Show welcome message as HTML popup bubble near the chathead
    if (this.welcomeMessage) {
      const bubble = this.shadow.querySelector('#wc-welcome-bubble');
      const bubbleName = this.shadow.querySelector('#wc-welcome-bubble .bubble-name');
      const bubbleText = this.shadow.querySelector('#wc-welcome-bubble .bubble-text');
      if (bubble && bubbleName && bubbleText) {
        bubbleName.textContent = this.brandName;
        bubbleText.textContent = this.welcomeMessage;
        // Short delay so the user sees the avatar appear first, then the bubble pops
        setTimeout(() => {
          bubble.classList.add('visible');
          // Auto-hide the bubble after 8 seconds
          setTimeout(() => {
            bubble.classList.remove('visible');
          }, 8000);
        }, 1500);
      }
    }

    // 4. Auto-connect to gateway WebSocket (don't wait for panel open)
    this.setConnectionState('connecting');
    this.setStatus('Connecting...');
    try {
      await this.gateway.connect();
    } catch (e: any) {
      this.setConnectionState('disconnected');
      this.setStatus('Tap to connect');
      console.error('[WebClaw] Auto-connect failed:', e);
    }
  }

  private createUI(): void {
    const host = document.createElement('webclaw-overlay');
    this.shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = OVERLAY_STYLES;
    this.shadow.appendChild(style);

    const container = document.createElement('div');
    container.className = `webclaw-container ${this.config.position}`;
    container.style.setProperty('--wc-color', this.config.avatarColor!);

    container.innerHTML = `
      <div class="webclaw-panel">
        <div class="webclaw-panel-header">
          <div class="webclaw-panel-header-content">
            <div class="webclaw-avatar-frame">
              <canvas id="wc-avatar" width="36" height="36" style="border-radius:50%;"></canvas>
            </div>
            <div class="webclaw-header-copy">
              <span class="webclaw-brand-label">BizGrow Holdings</span>
              <h3>BizGrow Holdings</h3>
              <div class="status">
                <span class="webclaw-status-dot"></span>
                <span class="status-text">Ready to help</span>
              </div>
            </div>
          </div>
          <div class="webclaw-agent-switch">
            <button class="webclaw-agent-pill active" data-agent="site">Site</button>
            <button class="webclaw-agent-pill" data-agent="personal">BizGrow Holdings</button>
          </div>
          <button class="webclaw-btn-close" aria-label="Close BizGrow Holdings chat panel" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
            </svg>
          </button>
        </div>
        <div class="webclaw-voice-bar">
          <div class="webclaw-voice-bars">
            <div class="webclaw-voice-bar-item" style="height:4px;animation-delay:0s;"></div>
            <div class="webclaw-voice-bar-item" style="height:8px;animation-delay:0.1s;"></div>
            <div class="webclaw-voice-bar-item" style="height:12px;animation-delay:0.2s;"></div>
            <div class="webclaw-voice-bar-item" style="height:8px;animation-delay:0.3s;"></div>
            <div class="webclaw-voice-bar-item" style="height:4px;animation-delay:0.4s;"></div>
          </div>
          <span>Listening... just speak naturally</span>
        </div>
        <div class="webclaw-messages"></div>
        <div class="webclaw-input-row">
          <input type="text" placeholder="Type a message..." aria-label="Chat message input" />
          <button class="webclaw-btn-send" aria-label="Send message" title="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="webclaw-welcome-bubble" id="wc-welcome-bubble">
        <div class="bubble-name"></div>
        <div class="bubble-text"></div>
      </div>
      <button class="webclaw-fab" aria-label="Open BizGrow Holdings chat" title="Chat with BizGrow Holdings">
        <canvas id="wc-fab-avatar" width="128" height="128" style="width:64px;height:64px;border-radius:50%;"></canvas>
      </button>
    `;

    this.shadow.appendChild(container);
    document.body.appendChild(host);

    // Cache references
    this.panel = container.querySelector('.webclaw-panel')!;
    this.messagesEl = container.querySelector('.webclaw-messages')!;
    this.statusDot = container.querySelector('.webclaw-status-dot')!;
    this.voiceBarEl = container.querySelector('.webclaw-voice-bar');

    // FAB avatar
    const fabCanvas = container.querySelector('#wc-fab-avatar') as HTMLCanvasElement;
    if (fabCanvas) {
      this.avatar = new Avatar(fabCanvas, this.config.avatarColor!, 128, {
        showLimbs: false, // Too small for limbs on FAB
      });
    }

    // Events
    const fab = container.querySelector('.webclaw-fab')!;
    fab.addEventListener('click', () => this.toggle());

    const closeBtn = container.querySelector('.webclaw-btn-close')!;
    closeBtn.addEventListener('click', () => this.close());

    const input = container.querySelector('input')!;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        this.sendText(input.value.trim());
        input.value = '';
      }
    });

    const sendBtn = container.querySelector('.webclaw-btn-send')! as HTMLElement;
    sendBtn.addEventListener('click', () => {
      if (input.value.trim()) {
        this.sendText(input.value.trim());
        input.value = '';
      }
    });

    // Agent switch pills
    container.querySelectorAll('.webclaw-agent-pill').forEach((pill: Element) => {
      pill.addEventListener('click', () => {
        const agent = (pill as HTMLElement).dataset.agent as 'site' | 'personal';
        this.switchAgent(agent);
      });
    });
  }

  private bindAudioEvents(): void {
    this.audio.on('stateChange', (state) => {
      switch (state) {
        case 'listening': this.avatar?.setState('listening'); break;
        case 'speaking': this.avatar?.setState('speaking'); break;
        case 'playing': this.avatar?.setState('speaking'); break;
        case 'idle': this.avatar?.setState('idle'); break;
      }
    });

    this.audio.on('speechStart', () => {
      // Barge-in: stop playback when user starts speaking
      this.audio.stopPlayback();
    });

    this.audio.on('amplitude', (amplitude) => {
      this.avatar?.setMouthTarget(Math.min(1, amplitude * 25));
    });
  }

  private bindGatewayEvents(): void {
    this.gateway.on('connected', () => {
      this.setConnectionState('connected');
      this.setStatus('Connected');
      this.avatar?.setState('idle');
      this.removeTypingIndicator();
      const snapshot = captureSnapshot();
      this.gateway.sendDomSnapshot(snapshot, window.location.href);

      this.sendScreenshotToGateway();

      // Start seamless voice on connect
      if (this.config.seamless) {
        this.startSeamlessVoice();
      }
    });

    this.gateway.on('disconnected', () => {
      this.setConnectionState('disconnected');
      this.setStatus('Reconnecting...');
      this.avatar?.setState('idle');
      this.removeTypingIndicator();
    });

    this.gateway.on('text', (msg) => {
      this.removeTypingIndicator();
      const text = msg.text as string;
      if (text) {
        this.addMessage('agent', text);
        this.lastTextTime = Date.now();
      }
      this.avatar?.setState('speaking');
      setTimeout(() => this.avatar?.setState(
        this.audio.isCapturing ? 'listening' : 'idle'
      ), 2000);

      // Check for voice agent-switch commands
      if (text) this.checkVoiceSwitchCommand(text);
    });

    this.gateway.on('audio', (msg) => {
      this.removeTypingIndicator();
      this.avatar?.setState('speaking');
      this.audio.playAudio(msg.data as ArrayBuffer | string);

      // Connect playback analyser to avatar for lip-sync
      const analyser = this.audio.getPlaybackAnalyser();
      if (analyser && this.avatar) {
        // Use the playback context for lip-sync
        const ctx = (analyser as any).context as AudioContext;
        if (ctx) this.avatar.connectAudio(ctx, analyser);
      }
    });

    this.gateway.on('action', async (msg) => {
      this.removeTypingIndicator();
      this.showTypingIndicator();
      this.avatar?.setState('acting');
      const args = (msg.args as Record<string, unknown>) || {};
      const callId = msg.call_id as string || 'unknown';
      const actionName = msg.action as string;
      const selector = (args.selector as string) || '';

      if (selector) {
        const fab = this.shadow.querySelector('.webclaw-fab');
        if (fab) {
          await animateToElement(
            fab.getBoundingClientRect(),
            selector,
            { color: this.config.avatarColor },
          );
        }
      }

      try {
        const result = await executeAction({
          action: actionName,
          id: callId,
          ...args,
        });
        // Send result back with call_id so gateway can match it to the pending Future
        this.gateway.sendActionResult(callId, result);
        this.addMessage('agent', `⚡ ${result.message || actionName}`);
      } catch (e: any) {
        // Send error back too so the Future resolves
        this.gateway.sendActionResult(callId, { action_id: callId, status: 'error', message: e.message });
        this.addMessage('agent', `⚡ Action error: ${e.message}`);
      }
      this.removeTypingIndicator();
      setTimeout(() => this.avatar?.setState(
        this.audio.isCapturing ? 'listening' : 'idle'
      ), 1000);
    });

    // Handle transcription (agent's spoken words transcribed to text)
    // Only show if no direct text event was received in the last 2 seconds
    // (prevents duplicate messages when both model_turn text and transcription arrive)
    this.gateway.on('transcription', (msg) => {
      if (msg.text && (Date.now() - this.lastTextTime > 2000)) {
        this.addMessage('agent', msg.text as string);
      }
    });

    // Handle gateway/ADK errors
    this.gateway.on('error', (msg) => {
      this.removeTypingIndicator();
      this.addMessage('agent', `Connection issue: ${msg.error || 'Unknown error'}`);
      this.avatar?.setState('idle');
    });
  }

  private async startSeamlessVoice(): Promise<void> {
    try {
      await this.audio.startSeamless((data) => {
        this.gateway.sendAudio(data, this.activePageLocation);
      });
      this.setStatus('Listening...');
      this.statusDot.className = 'webclaw-status-dot listening';
      if (this.voiceBarEl) {
        this.voiceBarEl.classList.add('active');
      }
    } catch (e) {
      console.error('[WebClaw] Seamless voice error:', e);
      this.setStatus('Connected (mic unavailable)');
    }
  }

  private switchAgent(agent: 'site' | 'personal'): void {
    this.currentAgent = agent;

    // Update pills
    this.shadow.querySelectorAll('.webclaw-agent-pill').forEach((pill: Element) => {
      const el = pill as HTMLElement;
      el.classList.toggle('active', el.dataset.agent === agent);
    });

    // Notify gateway
    this.gateway.sendText(`[SYSTEM: Switched to ${agent} agent]`);
    this.addMessage('agent', `Switched to ${agent === 'personal' ? 'your personal agent' : 'the site agent'}.`);
  }

  private checkVoiceSwitchCommand(text: string): void {
    const lower = text.toLowerCase();
    if (lower.includes('switching to your personal') || lower.includes('switching to my claw')) {
      this.switchAgent('personal');
    } else if (lower.includes('switching to site') || lower.includes('switching back')) {
      this.switchAgent('site');
    }
  }

  private async toggle(): Promise<void> {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle('open', this.isOpen);

    // If panel opened and we're disconnected, try to reconnect
    if (this.isOpen && this.connectionState === 'disconnected') {
      this.setConnectionState('connecting');
      this.setStatus('Connecting...');
      try {
        await this.gateway.connect();
      } catch (e: any) {
        this.setConnectionState('disconnected');
        this.setStatus('Connection failed');
        console.error('[WebClaw] Connection error:', e);
      }
    }

    // If panel opened and connected, add welcome message to chat if empty
    if (this.isOpen && this.connectionState === 'connected' && this.messagesEl.children.length === 0) {
      if (this.welcomeMessage) {
        this.addMessage('agent', this.welcomeMessage);
      }
    }
  }

  private close(): void {
    this.isOpen = false;
    this.panel.classList.remove('open');
    this.removeTypingIndicator();
    cleanupVisualizerElements();
  }

  private sendText(text: string): void {
    // Check for switch commands
    const lower = text.toLowerCase();
    if (lower.includes('switch to my') || lower.includes('my agent') || lower.includes('use my claw')) {
      this.switchAgent('personal');
      return;
    }
    if (lower.includes('switch to site') || lower.includes('site agent')) {
      this.switchAgent('site');
      return;
    }

    this.addMessage('user', text);
    this.gateway.sendText(text, this.activePageLocation);
  }

  private addMessage(role: 'user' | 'agent', text: string): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'webclaw-msg-wrapper';
    if (role === 'user') wrapper.classList.add('user');

    const msg = document.createElement('div');
    msg.className = `webclaw-msg ${role}`;
    msg.textContent = text;

    const timestamp = document.createElement('div');
    timestamp.className = 'webclaw-msg-timestamp';
    const now = new Date();
    timestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    wrapper.appendChild(msg);
    wrapper.appendChild(timestamp);
    this.messagesEl.appendChild(wrapper);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private showTypingIndicator(): void {
    if (this.typingIndicator) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'webclaw-msg-wrapper';
    const indicator = document.createElement('div');
    indicator.className = 'webclaw-msg typing';
    indicator.textContent = 'Agent is thinking';
    wrapper.appendChild(indicator);
    this.messagesEl.appendChild(wrapper);
    this.typingIndicator = wrapper;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private removeTypingIndicator(): void {
    if (this.typingIndicator) {
      this.typingIndicator.remove();
      this.typingIndicator = null;
    }
  }

  private setStatus(text: string): void {
    const statusText = this.shadow.querySelector('.status-text');
    if (statusText) statusText.textContent = text;
  }

  private setConnectionState(state: 'connected' | 'connecting' | 'disconnected'): void {
    this.connectionState = state;
    this.statusDot.classList.remove('connecting', 'disconnected', 'listening');
    if (state === 'connecting') this.statusDot.classList.add('connecting');
    else if (state === 'disconnected') this.statusDot.classList.add('disconnected');
  }

  private async sendScreenshotToGateway(): Promise<void> {
    const screenshot = await captureScreenshot();
    if (screenshot) {
      this.gateway.sendScreenshot(screenshot.data, screenshot.url);
    }
  }
}

// ========================================
// Auto-init
// ========================================

function init(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot());
  } else {
    boot();
  }
}

function boot(): void {
  const config = getConfig();
  (window as any).__webclaw = new WebClawEmbed(config);
}

init();
