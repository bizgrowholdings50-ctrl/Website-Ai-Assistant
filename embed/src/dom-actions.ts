/**
 * WebClaw DOM Actions
 * Executes agent tool calls on the actual page DOM.
 */

import { findElement, findElementWithRetry } from './element-finder';

export interface ActionRequest {
  action: string;
  id?: string;
  [key: string]: unknown;
}

export interface ActionResult {
  action_id: string;
  status: 'success' | 'error';
  message?: string;
  data?: unknown;
}

export async function executeAction(req: ActionRequest): Promise<ActionResult> {
  const id = req.id || 'unknown';
  try {
    switch (req.action) {
      // Match both short names ("click") and Gemini function names ("click_element")
      case 'click':
      case 'click_element':
        return await doClick(id, req.selector as string);
      case 'type':
      case 'type_text':
        return await doType(id, req.selector as string, req.text as string, req.clear_first as boolean);
      case 'scroll':
      case 'scroll_to':
        return await doScroll(id, req.selector as string, req.direction as string, req.amount as number);
      case 'scroll_to_top':
        return doScrollToTop(id);
      case 'scroll_to_bottom':
        return doScrollToBottom(id);
      case 'navigate':
      case 'navigate_to':
        return doNavigate(id, req.url as string);
      case 'highlight':
      case 'highlight_element':
        return await doHighlight(id, req.selector as string, req.message as string);
      case 'read':
      case 'read_page':
        return await doRead(id, req.selector as string);
      case 'select':
      case 'select_option':
        return await doSelect(id, req.selector as string, req.value as string);
      case 'check':
      case 'check_checkbox':
        return await doCheck(id, req.selector as string, req.checked as boolean);
      default:
        return { action_id: id, status: 'error', message: `Unknown action: ${req.action}` };
    }
  } catch (e: any) {
    return { action_id: id, status: 'error', message: e.message };
  }
}


async function doClick(id: string, selector: string): Promise<ActionResult> {
  // Try to find with retry in case element is loading
  let el = await findElementWithRetry(selector, 5, 100);
  if (!el) return { action_id: id, status: 'error', message: `Element not found: ${selector}` };
  (el as HTMLElement).click();
  return { action_id: id, status: 'success', message: `Clicked: ${selector}` };
}

async function doType(id: string, selector: string, text: string, clearFirst: boolean): Promise<ActionResult> {
  const el = await findElementWithRetry(selector, 5, 100) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return { action_id: id, status: 'error', message: `Element not found: ${selector}` };
  el.focus();
  if (clearFirst) el.value = '';
  el.value += text;
  // Use InputEvent for better React compatibility
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return { action_id: id, status: 'success', message: `Typed into: ${selector}` };
}

async function doScroll(id: string, selector: string, direction: string, amount: number): Promise<ActionResult> {
  if (selector) {
    const el = await findElementWithRetry(selector, 5, 100);
    if (!el) return { action_id: id, status: 'error', message: `Element not found: ${selector}` };
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return { action_id: id, status: 'success', message: `Scrolled to: ${selector}` };
  }
  const y = direction === 'up' ? -amount : amount;
  window.scrollBy({ top: y, behavior: 'smooth' });
  return { action_id: id, status: 'success', message: `Scrolled ${direction} ${amount}px` };
}

function doNavigate(id: string, url: string): ActionResult {
  window.location.href = url;
  return { action_id: id, status: 'success', message: `Navigating to: ${url}` };
}

async function doHighlight(id: string, selector: string, message: string): Promise<ActionResult> {
  const el = await findElementWithRetry(selector, 5, 100);
  if (!el) return { action_id: id, status: 'error', message: `Element not found: ${selector}` };

  // Create highlight overlay
  const rect = el.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'webclaw-highlight';
  overlay.style.cssText = `
    position: fixed; top: ${rect.top - 4}px; left: ${rect.left - 4}px;
    width: ${rect.width + 8}px; height: ${rect.height + 8}px;
    border: 3px solid #4285f4; border-radius: 8px;
    background: rgba(66, 133, 244, 0.1);
    pointer-events: none; z-index: 999998;
    animation: webclaw-pulse 1.5s ease-in-out 3;
  `;

  if (message) {
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
      background: #333; color: white; padding: 6px 12px; border-radius: 6px;
      font-size: 13px; white-space: nowrap; margin-bottom: 8px;
    `;
    tooltip.textContent = message;
    overlay.appendChild(tooltip);
  }

  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 5000);
  return { action_id: id, status: 'success', message: `Highlighted: ${selector}` };
}

async function doRead(id: string, selector: string): Promise<ActionResult> {
  const el = await findElementWithRetry(selector, 5, 100) || document.body;
  const text = (el.textContent || '').trim().substring(0, 2000);
  return { action_id: id, status: 'success', data: text };
}

async function doSelect(id: string, selector: string, value: string): Promise<ActionResult> {
  const el = await findElementWithRetry(selector, 5, 100) as HTMLSelectElement | null;
  if (!el) return { action_id: id, status: 'error', message: `Element not found: ${selector}` };
  // Try by value then by text
  const option = Array.from(el.options).find(o => o.value === value || o.text === value);
  if (!option) return { action_id: id, status: 'error', message: `Option not found: ${value}` };
  el.value = option.value;
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return { action_id: id, status: 'success', message: `Selected: ${value}` };
}

function doScrollToTop(id: string): ActionResult {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return { action_id: id, status: 'success', message: 'Scrolled to top of page' };
}

function doScrollToBottom(id: string): ActionResult {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  return { action_id: id, status: 'success', message: 'Scrolled to bottom of page' };
}

async function doCheck(id: string, selector: string, checked: boolean): Promise<ActionResult> {
  const el = await findElementWithRetry(selector, 5, 100) as HTMLInputElement | null;
  if (!el) return { action_id: id, status: 'error', message: `Element not found: ${selector}` };
  el.checked = checked;
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return { action_id: id, status: 'success', message: `${checked ? 'Checked' : 'Unchecked'}: ${selector}` };
}
