/**
 * WebClaw Screenshot Capture
 * Captures the viewport as a JPEG image for vision-based page understanding.
 * Uses html2canvas-lite approach for lightweight capture.
 */

export interface ScreenshotResult {
  data: string;       // base64 encoded
  mimeType: string;
  width: number;
  height: number;
  url: string;
}

/**
 * Capture the current viewport as a JPEG screenshot.
 * Uses Canvas API to render a simplified view of the page.
 *
 * For full-fidelity screenshots, the Chrome Extension uses
 * chrome.tabs.captureVisibleTab() instead.
 */
export async function captureScreenshot(
  maxWidth: number = 1024,
  quality: number = 0.7,
): Promise<ScreenshotResult | null> {
  try {
    // Try using the modern Screen Capture API if available (requires user gesture)
    // Fall back to a simplified canvas-based capture

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Scale down for token efficiency
    const scale = Math.min(1, maxWidth / viewportW);
    canvas.width = Math.round(viewportW * scale);
    canvas.height = Math.round(viewportH * scale);

    ctx.scale(scale, scale);

    // Draw a simplified representation
    // Background
    const bgColor = getComputedStyle(document.body).backgroundColor || '#ffffff';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, viewportW, viewportH);

    // Render visible elements (text, images, blocks)
    await renderElements(ctx, document.body, 0, 0, 3);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];

    return {
      data: base64,
      mimeType: 'image/jpeg',
      width: canvas.width,
      height: canvas.height,
      url: window.location.href,
    };
  } catch (e) {
    console.error('[WebClaw] Screenshot capture failed:', e);
    return null;
  }
}

/**
 * Render visible elements onto a canvas context.
 * Simplified renderer that captures layout and text without full CSS fidelity.
 */
async function renderElements(
  ctx: CanvasRenderingContext2D,
  element: Element,
  offsetX: number,
  offsetY: number,
  maxDepth: number,
): Promise<void> {
  if (maxDepth <= 0) return;

  const children = element.children;
  for (let i = 0; i < children.length && i < 100; i++) {
    const child = children[i];
    const tag = child.tagName.toLowerCase();

    // Skip non-visual elements
    if (['script', 'style', 'noscript', 'svg', 'meta', 'link', 'webclaw-overlay'].includes(tag)) {
      continue;
    }

    const rect = child.getBoundingClientRect();

    // Skip elements outside viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight ||
        rect.right < 0 || rect.left > window.innerWidth ||
        rect.width === 0 || rect.height === 0) {
      continue;
    }

    const style = getComputedStyle(child);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }

    // Draw background
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      ctx.fillStyle = style.backgroundColor;
      const borderRadius = parseFloat(style.borderRadius) || 0;
      if (borderRadius > 0) {
        roundRect(ctx, rect.left, rect.top, rect.width, rect.height, borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      }
    }

    // Draw border
    if (style.borderWidth && parseFloat(style.borderWidth) > 0 && style.borderStyle !== 'none') {
      ctx.strokeStyle = style.borderColor || '#ccc';
      ctx.lineWidth = parseFloat(style.borderWidth);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
    }

    // Draw images
    if (tag === 'img') {
      const img = child as HTMLImageElement;
      if (img.complete && img.naturalWidth > 0) {
        try {
          ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height);
        } catch {
          // Cross-origin image, draw placeholder
          ctx.fillStyle = '#e0e0e0';
          ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
          ctx.fillStyle = '#999';
          ctx.font = '12px sans-serif';
          ctx.fillText('[img]', rect.left + 4, rect.top + 16);
        }
      }
    }

    // Draw text for leaf-ish elements
    const textContent = getDirectText(child);
    if (textContent) {
      ctx.fillStyle = style.color || '#000';
      const fontSize = parseFloat(style.fontSize) || 14;
      const fontWeight = style.fontWeight || 'normal';
      const fontFamily = style.fontFamily?.split(',')[0]?.trim() || 'sans-serif';
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      // Simple text wrapping
      const words = textContent.split(/\s+/);
      let line = '';
      let y = rect.top + parseFloat(style.paddingTop || '0');
      const x = rect.left + parseFloat(style.paddingLeft || '0');
      const maxW = rect.width - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxW && line) {
          ctx.fillText(line, x, y);
          line = word;
          y += fontSize * 1.3;
          if (y > rect.bottom) break;
        } else {
          line = testLine;
        }
      }
      if (line && y <= rect.bottom) {
        ctx.fillText(line, x, y);
      }
    }

    // Recurse into children
    await renderElements(ctx, child, rect.left, rect.top, maxDepth - 1);
  }
}

/**
 * Get direct text content (not from children).
 */
function getDirectText(element: Element): string {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent?.trim() || '';
    }
  }
  return text.substring(0, 200);
}

/**
 * Draw a rounded rectangle path.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
