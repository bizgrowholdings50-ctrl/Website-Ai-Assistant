/**
 * WebClaw Action Visualizer
 * Animates the avatar flying to target DOM elements during agent actions.
 * Creates a visual trail from the FAB to the target, with a pulse on arrival.
 */

import { findElement } from './element-finder';

export interface VisualizerConfig {
  color: string;
  duration: number;   // ms
  trailCount: number;
}

const DEFAULT_CONFIG: VisualizerConfig = {
  color: '#FF4D4D',
  duration: 600,
  trailCount: 8,
};

/**
 * Animate a visual indicator from the FAB position to a target element.
 * Returns a promise that resolves when the animation completes.
 */
export function animateToElement(
  fabRect: DOMRect,
  targetSelector: string,
  config: Partial<VisualizerConfig> = {},
): Promise<boolean> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Find the target element
  const target = findTarget(targetSelector);
  if (!target) return Promise.resolve(false);

  const targetRect = target.getBoundingClientRect();

  return new Promise((resolve) => {
    // Create the flying indicator
    const indicator = document.createElement('div');
    indicator.className = 'webclaw-action-indicator';
    indicator.style.cssText = `
      position: fixed;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${cfg.color};
      box-shadow: 0 0 20px ${cfg.color}88, 0 0 40px ${cfg.color}44;
      z-index: 999999;
      pointer-events: none;
      left: ${fabRect.left + fabRect.width / 2 - 12}px;
      top: ${fabRect.top + fabRect.height / 2 - 12}px;
      transition: none;
    `;

    // Inner glow dot
    const inner = document.createElement('div');
    inner.style.cssText = `
      width: 10px; height: 10px;
      border-radius: 50%;
      background: white;
      position: absolute;
      top: 7px; left: 7px;
    `;
    indicator.appendChild(inner);
    document.body.appendChild(indicator);

    // Create trail particles
    const trails: HTMLElement[] = [];
    for (let i = 0; i < cfg.trailCount; i++) {
      const trail = document.createElement('div');
      trail.style.cssText = `
        position: fixed;
        width: ${8 - i * 0.5}px;
        height: ${8 - i * 0.5}px;
        border-radius: 50%;
        background: ${cfg.color};
        opacity: ${0.6 - i * 0.06};
        z-index: 999998;
        pointer-events: none;
        left: ${fabRect.left + fabRect.width / 2 - 4}px;
        top: ${fabRect.top + fabRect.height / 2 - 4}px;
        transition: none;
      `;
      document.body.appendChild(trail);
      trails.push(trail);
    }

    // Animate using requestAnimationFrame for smooth curves
    const startX = fabRect.left + fabRect.width / 2;
    const startY = fabRect.top + fabRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    // Bezier control point (arc upward)
    const midX = (startX + endX) / 2;
    const midY = Math.min(startY, endY) - 80;

    const startTime = performance.now();
    const trailPositions: Array<{ x: number; y: number }> = [];

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / cfg.duration, 1);

      // Ease-in-out cubic
      const ease = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      // Quadratic bezier position
      const x = (1 - ease) * (1 - ease) * startX + 2 * (1 - ease) * ease * midX + ease * ease * endX;
      const y = (1 - ease) * (1 - ease) * startY + 2 * (1 - ease) * ease * midY + ease * ease * endY;

      // Move indicator
      indicator.style.left = `${x - 12}px`;
      indicator.style.top = `${y - 12}px`;

      // Scale indicator (grow slightly mid-flight, shrink on arrival)
      const scale = 1 + Math.sin(ease * Math.PI) * 0.4;
      indicator.style.transform = `scale(${scale})`;

      // Update trail positions (delayed follow)
      trailPositions.unshift({ x, y });
      for (let i = 0; i < trails.length; i++) {
        const pos = trailPositions[Math.min((i + 1) * 2, trailPositions.length - 1)];
        if (pos) {
          trails[i].style.left = `${pos.x - 4}px`;
          trails[i].style.top = `${pos.y - 4}px`;
        }
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Arrival: pulse effect on target
        pulseTarget(target!, cfg.color);

        // Fade out indicator and trails
        indicator.style.transition = 'opacity 0.3s, transform 0.3s';
        indicator.style.opacity = '0';
        indicator.style.transform = 'scale(2)';

        for (const trail of trails) {
          trail.style.transition = 'opacity 0.2s';
          trail.style.opacity = '0';
        }

        setTimeout(() => {
          indicator.remove();
          trails.forEach(t => t.remove());
          resolve(true);
        }, 300);
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Clean up any lingering DOM elements from visualizer operations.
 */
export function cleanupVisualizerElements(): void {
  // Remove any leftover indicators
  const indicators = document.querySelectorAll('.webclaw-action-indicator');
  indicators.forEach(el => el.remove());

  // Remove any leftover pulses
  const pulses = document.querySelectorAll('[style*="webclaw-target-pulse"]');
  pulses.forEach(el => el.remove());
}

/**
 * Create a pulse/ring effect on the target element.
 */
function pulseTarget(element: Element, color: string): void {
  const rect = element.getBoundingClientRect();

  const pulse = document.createElement('div');
  pulse.style.cssText = `
    position: fixed;
    left: ${rect.left - 8}px;
    top: ${rect.top - 8}px;
    width: ${rect.width + 16}px;
    height: ${rect.height + 16}px;
    border: 3px solid ${color};
    border-radius: 8px;
    pointer-events: none;
    z-index: 999997;
    animation: webclaw-target-pulse 0.8s ease-out forwards;
  `;
  document.body.appendChild(pulse);

  // Inject animation if not already present
  if (!document.getElementById('webclaw-action-viz-styles')) {
    const style = document.createElement('style');
    style.id = 'webclaw-action-viz-styles';
    style.textContent = `
      @keyframes webclaw-target-pulse {
        0% {
          box-shadow: 0 0 0 0 ${color}66;
          opacity: 1;
        }
        70% {
          box-shadow: 0 0 0 20px ${color}00;
          opacity: 0.7;
        }
        100% {
          box-shadow: 0 0 0 30px ${color}00;
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => pulse.remove(), 1000);
}

/**
 * Find target element using the shared element finder utility.
 */
function findTarget(selector: string): Element | null {
  return findElement(selector);
}
