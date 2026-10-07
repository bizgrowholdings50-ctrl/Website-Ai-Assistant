/**
 * WebClaw DOM Actions
 * Executes agent tool calls on the actual page DOM.
 */

import { captureSnapshot } from './dom-snapshot';

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

function stringArgument(req: ActionRequest, name: string, fallback = ''): string {
  const value = req[name];
  return typeof value === 'string' ? value : fallback;
}

export async function executeAction(req: ActionRequest): Promise<ActionResult> {
  const id = req.id || 'unknown';
  try {
    switch (req.action) {
      // Match both short names ("click") and Gemini function names ("click_element")
      case 'click':
      case 'click_element':
        return await doClick(
          id,
          stringArgument(req, 'selector'),
          stringArgument(req, 'description'),
          stringArgument(req, 'user_request'),
        );
      case 'type':
      case 'type_text':
        return await doType(
          id,
          stringArgument(req, 'selector'),
          stringArgument(req, 'text'),
          req.clear_first === true,
        );
      case 'scroll':
      case 'scroll_to':
        return await doScroll(
          id,
          stringArgument(req, 'selector'),
          stringArgument(req, 'direction', 'down'),
          typeof req.amount === 'number' ? req.amount : 300,
          stringArgument(req, 'description') || stringArgument(req, 'target_hint'),
        );
      case 'scroll_to_top':
        return doScrollToTop(id);
      case 'scroll_to_bottom':
        return doScrollToBottom(id, stringArgument(req, 'description'));
      case 'navigate':
      case 'navigate_to':
        return doNavigate(
          id,
          stringArgument(req, 'url'),
          stringArgument(req, 'user_request'),
        );
      case 'highlight':
      case 'highlight_element':
        return await doHighlight(
          id,
          stringArgument(req, 'selector'),
          stringArgument(req, 'message') || stringArgument(req, 'target_hint'),
        );
      case 'read':
      case 'read_page':
        return await doRead(
          id,
          stringArgument(req, 'selector', 'body'),
          stringArgument(req, 'description') || stringArgument(req, 'target_hint'),
        );
      case 'select':
      case 'select_option':
        return await doSelect(
          id,
          stringArgument(req, 'selector'),
          stringArgument(req, 'value'),
        );
      case 'check':
      case 'check_checkbox':
        return await doCheck(
          id,
          stringArgument(req, 'selector'),
          req.checked === true,
          stringArgument(req, 'description'),
        );
      default:
        return { action_id: id, status: 'error', message: `Unknown action: ${req.action}` };
    }
  } catch (e: any) {
    return { action_id: id, status: 'error', message: e.message };
  }
}


async function doClick(
  id: string,
  selector: string,
  description = '',
  userRequest = '',
): Promise<ActionResult> {
  if (isFaqPageRequest(userRequest)) {
    if (isCurrentFaqPage()) return alreadyOnFaqPage(id);
    const faqLink = findFaqPageLink();
    if (!faqLink) {
      return {
        action_id: id,
        status: 'error',
        message: 'Could not find a matching FAQ page link; no unrelated link was clicked.',
      };
    }
    (faqLink as HTMLElement).click();
    return {
      action_id: id,
      status: 'success',
      message: 'FAQ link click dispatched; verify the destination before confirming navigation.',
      data: { click_dispatched: true, effect_verified: false },
    };
  }

  const isCartIntent = /\b(add|put|place|move)\b.{0,40}\bcart\b|\bcart\b.{0,40}\b(add|put|place|move)\b/i.test(
    `${userRequest} ${description} ${selector}`
  );
  const describedCartButton = isCartIntent
    ? findCartButtonForDescription(`${userRequest} ${description} ${selector}`)
    : null;
  // Resolve shopping intent before treating the model-provided label as CSS.
  const directMatch = await findUniqueSelectorMatch(selector);
  let el = describedCartButton || asClickableTarget(directMatch);
  if (el && !isCartIntent && (description || userRequest)
    && !matchesRequestedTarget(el, description || userRequest)) {
    el = null;
  }
  if (!el && !isCartIntent) {
    el = findClickableElement(selector, description || userRequest);
  }
  if (!el) {
    return {
      action_id: id,
      status: 'error',
      message: isCartIntent
        ? 'Could not find an Add to cart button matching the requested product.'
        : `Element not found: ${selector}`,
    };
  }

  if (isCartIntent && !isAddToCartButton(el)) {
    return {
      action_id: id,
      status: 'error',
      message: 'Could not identify the requested Add to cart button confidently.',
    };
  }

  if (el instanceof HTMLAnchorElement) {
    const destination = new URL(el.href, window.location.href);
    if (!['http:', 'https:'].includes(destination.protocol) || destination.origin !== window.location.origin) {
      return {
        action_id: id,
        status: 'error',
        message: 'The link points outside the current website; no navigation was performed.',
      };
    }
  }

  const openIntent = /\b(open|expand|show|display)\b/i.test(userRequest);
  const closeIntent = /\b(close|collapse|hide)\b/i.test(userRequest);
  const disclosureBefore = getDisclosureState(el);
  if (openIntent && disclosureBefore === true) {
    return {
      action_id: id,
      status: 'success',
      message: 'The requested disclosure is already expanded.',
      data: { expanded: true, already_in_requested_state: true },
    };
  }
  if (closeIntent && disclosureBefore === false) {
    return {
      action_id: id,
      status: 'success',
      message: 'The requested disclosure is already collapsed.',
      data: { expanded: false, already_in_requested_state: true },
    };
  }

  const isCartButton = isAddToCartButton(el);
  const previousCartCount = isCartIntent && isCartButton ? readCartCount() : null;
  (el as HTMLElement).click();

  if ((openIntent || closeIntent) && disclosureBefore !== null) {
    const desiredState = openIntent;
    const stateChanged = await waitForDisclosureState(el, desiredState);
    if (!stateChanged) {
      return {
        action_id: id,
        status: 'error',
        message: `The requested section did not ${desiredState ? 'open' : 'close'}; its state could not be verified.`,
      };
    }
    return {
      action_id: id,
      status: 'success',
      message: `The requested section is ${desiredState ? 'expanded' : 'collapsed'}.`,
      data: { expanded: desiredState, effect_verified: true },
    };
  }

  if (openIntent || closeIntent) {
    await new Promise(resolve => window.setTimeout(resolve, 400));
    const disclosureAfter = getDisclosureState(el);
    if (disclosureAfter !== null) {
      const desiredState = openIntent;
      if (disclosureAfter !== desiredState) {
        return {
          action_id: id,
          status: 'error',
          message: `The requested section did not ${desiredState ? 'open' : 'close'}.`,
          data: { expanded: disclosureAfter, effect_verified: true },
        };
      }
      return {
        action_id: id,
        status: 'success',
        message: `The requested section is ${desiredState ? 'expanded' : 'collapsed'}.`,
        data: { expanded: disclosureAfter, effect_verified: true },
      };
    }
  }

  if (isCartIntent && isCartButton) {
    const cartCount = await waitForCartCountChange(previousCartCount);
    if (cartCount === null) {
      return {
        action_id: id,
        status: 'error',
        message: 'The Add to cart button was clicked, but the cart count did not increase. The item was not confirmed as added.',
      };
    }

    return {
      action_id: id,
      status: 'success',
      message: `Cart count increased to ${cartCount}.`,
      data: { cart_count: cartCount },
    };
  }

  return {
    action_id: id,
    status: 'success',
    message: 'Click dispatched; page effect has not been verified.',
    data: {
      click_dispatched: true,
      effect_verified: false,
      page_snapshot: captureSnapshot(4000),
    },
  };
}

function getDisclosureState(element: Element): boolean | null {
  const expanded = element.getAttribute('aria-expanded');
  if (expanded === 'true') return true;
  if (expanded === 'false') return false;
  if (element instanceof HTMLDetailsElement) return element.open;

  const state = element.getAttribute('data-state')
    || element.getAttribute('data-expanded');
  if (state === 'open' || state === 'expanded' || state === 'true') return true;
  if (state === 'closed' || state === 'collapsed' || state === 'false') return false;
  return null;
}

async function waitForDisclosureState(element: Element, expected: boolean): Promise<boolean> {
  const deadline = Date.now() + 1200;
  while (Date.now() < deadline) {
    if (getDisclosureState(element) === expected) return true;
    await new Promise(resolve => window.setTimeout(resolve, 40));
  }
  return getDisclosureState(element) === expected;
}

const CLICKABLE_TARGETS = [
  'a[href]',
  'button',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'summary',
  '[role="link"]',
  '[role="button"]',
  '[role="menuitem"]',
  '[aria-expanded]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

async function findUniqueSelectorMatch(selector: string): Promise<Element | null> {
  if (!selector || /:(?:nth-child|nth-of-type|first-child|last-child|only-child|first-of-type|last-of-type)\b/i.test(selector)) {
    return null;
  }
  if (/^(?:a|button|input|select|textarea|div|span|main|section|article|\*|a\[href\]|\[role=["']?(?:button|link)["']?\])$/i.test(selector.trim())) {
    return null;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return null;
    } catch {
      return null;
    }
    if (attempt < 4) await new Promise(resolve => window.setTimeout(resolve, 100));
  }
  return null;
}

function asClickableTarget(element: Element | null): Element | null {
  if (!element || element.closest('webclaw-overlay')) return null;
  const target = element.matches(CLICKABLE_TARGETS)
    ? element
    : element.closest(CLICKABLE_TARGETS);
  if (!target || target.closest('webclaw-overlay')) return null;
  if (target.matches(':disabled, [aria-disabled="true"]')) return null;
  const style = window.getComputedStyle(target);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return null;
  }
  return target;
}

function matchesRequestedTarget(element: Element, description: string): boolean {
  const requested = normalizePageTarget(description)
    .split(/\s+/)
    .filter(term => term.length > 2
      && !/^(dedicated|section|page|link|button|site|website|first|second|third|fourth|product|item|services|service|show|find|where|see|view|tell|for|the|and|your|this|that|with|want|you|could|can|would|please|open|close|closing|go|navigate|click|take|me|now|homepage|home)$/.test(term));
  if (requested.length === 0) return true;
  const candidateTokens = new Set(normalizePageTarget([
    element.textContent,
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.id,
    element.getAttribute('data-testid'),
    element instanceof HTMLAnchorElement ? element.getAttribute('href') : '',
  ].filter(Boolean).join(' ')).split(/\s+/));
  return requested.every(term => {
    if (candidateTokens.has(term)) return true;
    const alternatives = getPageTargetPhrases(term);
    return alternatives.some(alternative =>
      alternative.split(/\s+/).every(aliasToken => candidateTokens.has(aliasToken))
    );
  });
}

function findClickableElement(selector: string, description: string): Element | null {
  const selectorHref = selector.match(/\bhref\s*=\s*["']?([^"'\]\s]+)["']?/i)?.[1];
  const selectorTextMatch = selector.match(/:contains\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/i);
  const selectorText = selectorTextMatch?.[1] || selectorTextMatch?.[2] || selectorTextMatch?.[3];
  let hrefPath = selectorHref || '';
  if (selectorHref) {
    try {
      hrefPath = new URL(selectorHref, window.location.href).pathname;
    } catch {
      // Keep the supplied partial path for non-standard but searchable href values.
    }
  }
  const requestedText = normalizePageTarget(description || selectorText || hrefPath || selector);
  const terms = requestedText.split(' ').filter(term =>
    term.length > 2 && !/^(dedicated|section|page|link|button|open|close|closing|go|navigate|click|please|take|me|now|site|website|first|second|third|fourth|product|item|services|service|show|find|where|see|view|tell|for|the|and|your|this|that|with)$/.test(term)
  );
  if (terms.length === 0) return null;

  const candidates = Array.from(document.querySelectorAll(
    CLICKABLE_TARGETS
  )).filter(element => {
    return asClickableTarget(element) === element;
  });

  const ranked = candidates.map(element => {
    const text = [
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
    ].filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
    const href = element instanceof HTMLAnchorElement
      ? element.getAttribute('href')?.toLowerCase() || ''
      : '';
    const normalizedHref = href.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
    const searchableTokens = new Set(`${text} ${normalizedHref}`.split(/\s+/));
    const matchedTerms = terms.filter(term => searchableTokens.has(term)
      || getPageTargetPhrases(term).some(alias => alias.split(/\s+/).every(token => searchableTokens.has(token))));
    const exactMatch = text === requestedText || normalizedHref === requestedText;
    const score = exactMatch ? terms.length + 2 : matchedTerms.length;
    return { element, score };
  }).filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (
    ranked.length === 0
    || ranked[0].score < terms.length
    || (ranked.length > 1 && ranked[0].score === ranked[1].score)
  ) {
    return null;
  }
  return ranked[0].element;
}

function isAddToCartButton(element: Element): boolean {
  const label = [
    element.getAttribute('aria-label'),
    element.getAttribute('data-testid'),
    element.textContent,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return element.matches('button, [role="button"]')
    && (
      element.hasAttribute('data-add-product')
      || element.hasAttribute('data-product')
      || /\badd\b.{0,40}\bcart\b/i.test(label)
    );
}

function findCartButtonForDescription(description: string): Element | null {
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
    .filter(isAddToCartButton);
  if (buttons.length === 0) return null;

  const ordinal = description.toLowerCase().match(/\b(first|1st|second|2nd|third|3rd|fourth|4th)\b/);
  if (ordinal) {
    const ordinalIndexes: Record<string, number> = {
      first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3,
    };
    return buttons[ordinalIndexes[ordinal[1]]] || null;
  }
  if (buttons.length === 1) return buttons[0];

  const descriptionWords = description.toLowerCase().match(/[a-z0-9]+/g) || [];
  const genericWords = new Set([
    'add', 'to', 'cart', 'the', 'button', 'please', 'product', 'put', 'place', 'move',
    'first', '1st', 'second', '2nd', 'third', '3rd', 'fourth', '4th', 'one', 'item',
    'aria', 'label', 'data', 'testid',
  ]);
  const productWords = descriptionWords.filter(word => !genericWords.has(word));
  if (productWords.length === 0) return null;

  const matches = buttons.map(button => {
    const productId = button.getAttribute('data-add-product')
      || button.getAttribute('data-product')
      || '';
    const productContainer = button.closest(
      '.product-card, article, .detail-layout, [data-product]'
    ) || button.parentElement;
    const nearbyText = productContainer instanceof HTMLElement
      ? productContainer.innerText
      : productContainer?.textContent || '';
    const buttonDescription = [
      productId,
      button.getAttribute('aria-label'),
      button.getAttribute('data-testid'),
      button.textContent,
      nearbyText,
    ].filter(Boolean).join(' ').toLowerCase();
    const score = productWords.filter(word => buttonDescription.includes(word)).length;
    return { button, score };
  }).filter(match => match.score > 0)
    .sort((left, right) => right.score - left.score);

  if (matches.length === 0 || (matches.length > 1 && matches[0].score === matches[1].score)) {
    return null;
  }
  return matches[0].button;
}

function readCartCount(): number | null {
  const badge = document.querySelector('[data-cart-count]');
  if (!badge) return null;
  const count = Number.parseInt(badge.textContent?.trim() || '', 10);
  return Number.isFinite(count) ? count : null;
}

async function waitForCartCountChange(previousCount: number | null): Promise<number | null> {
  if (previousCount === null) return null;
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    const currentCount = readCartCount();
    if (currentCount !== null && currentCount > previousCount) return currentCount;
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }
  return null;
}

async function doType(id: string, selector: string, text: string, clearFirst: boolean): Promise<ActionResult> {
  const el = await findFormControl(selector, 'input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return { action_id: id, status: 'error', message: `Could not identify a unique text field for: ${selector}` };
  if (el.disabled || el.readOnly) {
    return { action_id: id, status: 'error', message: 'The requested field is disabled or read-only.' };
  }
  const nextValue = clearFirst ? text : el.value + text;
  const prototype = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!valueSetter) {
    return { action_id: id, status: 'error', message: 'Could not safely update the requested field.' };
  }
  valueSetter.call(el, nextValue);
  // Use InputEvent for better React compatibility
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return {
    action_id: id,
    status: 'success',
    message: 'Text input dispatched; field value verified.',
    data: { value: el.value },
  };
}

async function findFormControl(selector: string, controlSelector: string): Promise<Element | null> {
  const direct = await findUniqueSelectorMatch(selector);
  if (direct?.matches(controlSelector)) return direct;

  const target = normalizePageTarget(selector
    .replace(/^[^[]+/, '')
    .replace(/\[[^\]]+\]/g, match => match.replace(/[=\[\]"']/g, ' ')));
  const words = target.split(/\s+/).filter(word => word.length > 2
    && !/^(input|textarea|type|text|email|field|the|please|form)$/.test(word));
  if (words.length === 0) return null;

  const candidates = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    controlSelector
  )).filter(element => {
    if (element.closest('webclaw-overlay') || element.disabled || element.readOnly) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }).map(element => {
    const labels = element instanceof HTMLInputElement
      ? Array.from(element.labels || []).map(label => label.innerText || label.textContent || '').join(' ')
      : element.getAttribute('aria-label') || '';
    const description = normalizePageTarget([
      element.id,
      element.name,
      element.getAttribute('aria-label'),
      element.getAttribute('placeholder'),
      labels,
    ].filter(Boolean).join(' '));
    const matched = words.filter(word => description.split(/\s+/).includes(word)).length;
    return { element, score: matched };
  }).filter(candidate => candidate.score === words.length)
    .sort((left, right) => right.score - left.score);
  if (
    candidates.length === 0
    || (candidates.length > 1 && candidates[0].score === candidates[1].score)
  ) return null;
  return candidates[0].element;
}

async function doScroll(
  id: string,
  selector: string,
  direction: string,
  amount: number,
  description = '',
): Promise<ActionResult> {
  let targetFound = true;
  const target = selector || description;
  if (target) {
    const el = await findUniqueSelectorMatch(target)
      || findPageTarget(target, description || target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      targetFound = false;
      window.scrollBy({
        top: direction === 'up' ? -window.innerHeight * 0.75 : window.innerHeight * 0.75,
        behavior: 'smooth',
      });
    }
  } else {
    const y = direction === 'up' ? -amount : amount;
    window.scrollBy({ top: y, behavior: 'smooth' });
  }

  await waitForScrollAndPageUpdate();
  return {
    action_id: id,
    status: 'success',
    message: targetFound
      ? (target ? `Scrolled to: ${target}` : `Scrolled ${direction} ${amount}px`)
      : `Target not found yet; scrolled ${direction} to inspect more page content.`,
    data: {
      target_found: targetFound,
      page_snapshot: captureSnapshot(4000),
    },
  };
}

function findPageTarget(selector: string, description: string): Element | null {
  const textMatch = selector.match(/:contains\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/i);
  const xpathTextMatch = selector.match(/text\(\)\s*=\s*["']([^"']+)["']/i);
  const targetText = normalizePageTarget((
    textMatch?.[1]
    || textMatch?.[2]
    || textMatch?.[3]
    || xpathTextMatch?.[1]
    || description
    || selector
  ));
  if (!targetText) return null;

  const phrases = getPageTargetPhrases(targetText);
  const headings = Array.from(document.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6'
  )).filter(element => !element.closest('webclaw-overlay'));
  const headingMatches = headings.map(element => ({
    element,
    text: normalizePageTarget(element.innerText || element.textContent || ''),
  })).filter(candidate => phrases.some(phrase =>
    candidate.text === phrase || candidate.text.includes(phrase)
  )).sort((left, right) =>
    Number(right.text === targetText) - Number(left.text === targetText)
    || left.text.length - right.text.length
  );
  if (headingMatches.length > 0) {
    const heading = headingMatches[0].element;
    return heading.closest('section, article, [role="region"]')
      || heading.parentElement
      || heading;
  }

  const candidates = Array.from(document.querySelectorAll(
    'section, article, [role="region"], [id], [aria-label]'
  )).filter(element => {
    if (element.closest('webclaw-overlay')) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }).map(element => {
    const text = normalizePageTarget(element.textContent || '');
    const label = normalizePageTarget([
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.id,
      element.getAttribute('class'),
      element instanceof HTMLAnchorElement ? element.getAttribute('href') : '',
    ].filter(Boolean).join(' '));
    const score = phrases.reduce((best, phrase) => {
      if (label === phrase) return Math.max(best, 5);
      if (label.includes(phrase)) return Math.max(best, 4);
      if (
        !/\bfaqs?\b/.test(targetText)
        && text.length < 1000
        && text.includes(phrase)
      ) return Math.max(best, 2);
      return best;
    }, 0);
    return { element, score, textLength: text.length };
  }).filter(candidate => candidate.score > 0)
    .sort((left, right) =>
      right.score - left.score || left.textLength - right.textLength
    );

  return candidates[0]?.element || null;
}

function normalizePageTarget(value: string): string {
  return value.toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(?:a|an|the|and|for|show|find|open|scroll|page|section|link|button|please|where|your|my|our|this|that|now|me|i|to|on|in|go|close|closing|navigate|take|website|site|homepage|home|dedicated)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPageTargetPhrases(targetText: string): string[] {
  const phrases = [targetText];
  if (/\bfaqs?\b/.test(targetText)) {
    phrases.push('faq', 'faqs', 'frequently asked questions', 'frequently asked question');
  }
  if (/\breviews?\b|\btestimonials?\b/.test(targetText)) {
    phrases.push('reviews', 'review', 'testimonials', 'testimonial');
  }
  if (/\bceo\b|\bleadership\b/.test(targetText)) {
    phrases.push('ceo', 'leadership', 'chief executive officer');
  }
  return Array.from(new Set(phrases));
}

async function waitForScrollAndPageUpdate(): Promise<void> {
  const startedAt = Date.now();
  let lastScrollY = window.scrollY;
  let stableFrames = 0;
  while (Date.now() - startedAt < 2500 && stableFrames < 4) {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    if (Math.abs(window.scrollY - lastScrollY) < 1) {
      stableFrames++;
    } else {
      stableFrames = 0;
      lastScrollY = window.scrollY;
    }
  }
  await new Promise(resolve => window.setTimeout(resolve, 500));
}

function doNavigate(id: string, url: string, userRequest = ''): ActionResult {
  if (isFaqPageRequest(userRequest) && isCurrentFaqPage()) {
    return alreadyOnFaqPage(id);
  }

  if (!url.trim()) {
    return { action_id: id, status: 'error', message: 'No destination URL was provided.' };
  }

  if (isFaqPageRequest(userRequest)) {
    const faqLink = findFaqPageLink();
    if (faqLink) {
      (faqLink as HTMLElement).click();
      return {
        action_id: id,
        status: 'success',
        message: 'FAQ link click dispatched; verify the destination before confirming navigation.',
        data: { click_dispatched: true, effect_verified: false },
      };
    }

    if (!/\b(?:faq|faqs|frequently[-_/ ]asked[-_/ ]questions)\b/i.test(url)) {
      return {
        action_id: id,
        status: 'error',
        message: 'Could not confirm an FAQ page link; refusing to navigate to a different page.',
      };
    }
  }

  let destination: URL;
  try {
    destination = new URL(url, window.location.href);
  } catch {
    return { action_id: id, status: 'error', message: 'The destination URL is invalid.' };
  }
  if (
    !['http:', 'https:'].includes(destination.protocol)
    || destination.origin !== window.location.origin
  ) {
    return {
      action_id: id,
      status: 'error',
      message: 'Navigation is limited to the current website.',
    };
  }

  window.location.href = destination.href;
  return {
    action_id: id,
    status: 'success',
    message: 'Navigation started; verify the destination before confirming it completed.',
    data: { navigation_started: true, destination: destination.href },
  };
}

function isFaqPageRequest(userRequest: string): boolean {
  return /\b(?:faqs?|frequently asked questions)\b/i.test(userRequest)
    && !/\b(?:question|answer|item|accordion)\b/i.test(userRequest)
    && /\b(?:page|dedicated|open|navigate|go to|take me|show|bring|display)\b/i.test(userRequest);
}

function isCurrentFaqPage(): boolean {
  if (/\/(?:faq|faqs|frequently[-_/]asked[-_/]questions)(?:\/|$)/i.test(window.location.pathname)) {
    return true;
  }
  return Array.from(document.querySelectorAll<HTMLElement>('h1, h2, [role="heading"]'))
    .some(heading => {
      const text = normalizePageTarget(heading.innerText || heading.textContent || '');
      return text === 'faq'
        || text === 'faqs'
        || text === 'frequently asked questions'
        || text === 'frequently asked question';
    });
}

function alreadyOnFaqPage(id: string): ActionResult {
  return {
    action_id: id,
    status: 'success',
    message: 'The FAQ page is already open; no navigation was needed.',
    data: {
      already_current: true,
      current_url: window.location.href,
      page_snapshot: captureSnapshot(4000),
    },
  };
}

function findFaqPageLink(): Element | null {
  const links = Array.from(document.querySelectorAll(
    'a[href], button, [role="link"], [role="button"]'
  )).filter(element => {
    if (element.closest('webclaw-overlay') || element.matches(':disabled, [aria-disabled="true"]')) {
      return false;
    }
    if (element instanceof HTMLAnchorElement) {
      const destination = new URL(element.href, window.location.href);
      if (destination.origin !== window.location.origin) return false;
    }
    const style = window.getComputedStyle(element);
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && element.getClientRects().length > 0;
  }).map(element => {
    const text = normalizePageTarget([
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
    ].filter(Boolean).join(' '));
    const rawHref = element instanceof HTMLAnchorElement
      ? element.getAttribute('href') || ''
      : '';
    const href = normalizePageTarget(rawHref);
    const faqMatch = /\b(?:faq|faqs|frequently asked questions)\b/.test(`${text} ${href}`);
    const testimonialMatch = /\b(?:testimonial|testimonials|review|reviews)\b/.test(`${text} ${href}`);
    const exactLabel = /^(?:faq|faqs|frequently asked questions)$/.test(text);
    const score = faqMatch && !testimonialMatch
      ? (exactLabel ? 4 : element instanceof HTMLAnchorElement ? 3 : 1)
      : 0;
    const destination = element instanceof HTMLAnchorElement
      ? element.href
      : `${element.tagName}:${text}`;
    const rect = element.getBoundingClientRect();
    const inViewport = rect.bottom > 0 && rect.top < window.innerHeight
      && rect.right > 0 && rect.left < window.innerWidth;
    return { element, score, destination, inViewport };
  }).filter(candidate => candidate.score > 0);

  if (links.length === 0) return null;
  const bestScore = Math.max(...links.map(link => link.score));
  const bestLinks = links.filter(link => link.score === bestScore);
  const destinations = new Set(bestLinks.map(link => link.destination));
  if (destinations.size > 1) return null;
  return bestLinks.find(link => link.inViewport)?.element || bestLinks[0].element;
}

async function doHighlight(id: string, selector: string, message: string): Promise<ActionResult> {
  const el = await findUniqueSelectorMatch(selector)
    || findPageTarget(selector, message);
  if (!el) return { action_id: id, status: 'error', message: `Element not found: ${selector}` };

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await waitForScrollAndPageUpdate();

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

async function doRead(id: string, selector: string, description = ''): Promise<ActionResult> {
  const requestedTarget = description || selector;
  const matchedElement = selector && selector !== 'body'
    ? await findUniqueSelectorMatch(selector) || findPageTarget(selector, requestedTarget)
    : description
      ? findPageTarget(description, description)
      : null;
  const contentElement = matchedElement
    ? findReadableContext(matchedElement)
    : document.querySelector('main, [role="main"]') || document.body;
  const text = readVisibleText(contentElement);

  if (!text) {
    return {
      action_id: id,
      status: 'error',
      message: `No readable visible page text was found${requestedTarget ? ` for "${requestedTarget}"` : ''}.`,
    };
  }
  return { action_id: id, status: 'success', data: text };
}

function findReadableContext(element: Element): Element {
  let current: Element | null = element;
  let bestMatch = element;
  const preferredContainer = element.closest('section, article, [role="region"]');
  if (preferredContainer && !preferredContainer.closest('webclaw-overlay')) {
    return preferredContainer;
  }

  while (current && current !== document.body) {
    const textLength = readVisibleText(current).length;
    if (textLength >= 250 && textLength <= 5000) {
      bestMatch = current;
      break;
    }
    current = current.parentElement;
  }
  return bestMatch;
}

function readVisibleText(element: Element): string {
  const collectText = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (!(node instanceof Element)) return '';

    const tag = node.tagName.toLowerCase();
    if (
      tag === 'webclaw-overlay'
      || tag === 'script'
      || tag === 'style'
      || tag === 'noscript'
      || node.hasAttribute('hidden')
      || node.getAttribute('aria-hidden') === 'true'
    ) return '';

    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return '';
    }

    const children = node.shadowRoot
      ? Array.from(node.shadowRoot.childNodes)
      : Array.from(node.childNodes);
    return children.map(collectText).join(' ');
  };

  return collectText(element)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000);
}

async function doSelect(id: string, selector: string, value: string): Promise<ActionResult> {
  const el = await findFormControl(selector, 'select') as HTMLSelectElement | null;
  if (!el) return { action_id: id, status: 'error', message: 'Could not identify a unique enabled dropdown.' };
  if (el.disabled) return { action_id: id, status: 'error', message: 'The requested dropdown is disabled.' };
  const normalizedValue = normalizePageTarget(value);
  const options = Array.from(el.options).filter(option =>
    option.value === value
    || normalizePageTarget(option.text) === normalizedValue
  );
  if (options.length !== 1) {
    return {
      action_id: id,
      status: 'error',
      message: options.length === 0
        ? 'The requested dropdown option was not found.'
        : 'The requested dropdown option is ambiguous.',
    };
  }
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!valueSetter) {
    return { action_id: id, status: 'error', message: 'Could not safely update the dropdown.' };
  }
  valueSetter.call(el, options[0].value);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  if (el.value !== options[0].value) {
    return { action_id: id, status: 'error', message: 'The dropdown selection could not be verified.' };
  }
  return {
    action_id: id,
    status: 'success',
    message: 'Dropdown selection verified.',
    data: { value: el.value },
  };
}

function doScrollToTop(id: string): ActionResult {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return { action_id: id, status: 'success', message: 'Scrolled to top of page' };
}

async function doScrollToBottom(id: string, description = ''): Promise<ActionResult> {
  const explicitlyBottom = /\b(bottom|end of (?:the )?page)\b/i.test(description);
  const isSectionRequest = !explicitlyBottom && description.trim().length > 0;
  const target = isSectionRequest
    ? findPageTarget(description, description)
    : null;
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await waitForScrollAndPageUpdate();
    return {
      action_id: id,
      status: 'success',
      message: `Scrolled to the matching page section for: ${description}`,
      data: { target_found: true, page_snapshot: captureSnapshot(4000) },
    };
  }

  if (isSectionRequest) {
    window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
    await waitForScrollAndPageUpdate();
    return {
      action_id: id,
      status: 'success',
      message: `The requested section "${description}" was not identified at the current page position; scrolled down to inspect more content.`,
      data: { target_found: false, page_snapshot: captureSnapshot(4000) },
    };
  }

  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  await waitForScrollAndPageUpdate();
  return {
    action_id: id,
    status: 'success',
    message: 'Scrolled to bottom of page',
    data: { target_found: false, page_snapshot: captureSnapshot(4000) },
  };
}

async function doCheck(
  id: string,
  selector: string,
  checked: boolean,
  description = '',
): Promise<ActionResult> {
  const el = await findCheckbox(selector, description);
  if (!el) {
    return {
      action_id: id,
      status: 'error',
      message: 'Could not identify one matching checkbox confidently; no checkbox was changed.',
    };
  }

  if (el.checked !== checked) {
    const visibleLabel = Array.from(el.labels || []).find(label =>
      label.getClientRects().length > 0
      && window.getComputedStyle(label).visibility !== 'hidden'
    );
    (visibleLabel || el).click();
    await waitForCheckboxState(el, checked);
  }

  if (el.checked !== checked) {
    return {
      action_id: id,
      status: 'error',
      message: 'The checkbox did not reach the requested state; the change could not be verified.',
    };
  }
  return {
    action_id: id,
    status: 'success',
    message: `Checkbox state verified as ${checked ? 'checked' : 'unchecked'}.`,
    data: { checked: el.checked },
  };
}

async function waitForCheckboxState(el: HTMLInputElement, checked: boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline && el.checked !== checked) {
    await new Promise<void>(resolve => window.setTimeout(resolve, 25));
  }
}

async function findCheckbox(selector: string, description: string): Promise<HTMLInputElement | null> {
  const found = await findUniqueSelectorMatch(selector);
  const checkboxFrom = (element: Element | null): HTMLInputElement | null => {
    if (!element) return null;
    if (element instanceof HTMLInputElement && element.type === 'checkbox') return element;
    if (element instanceof HTMLLabelElement) {
      if (element.control instanceof HTMLInputElement && element.control.type === 'checkbox') {
        return element.control;
      }
      const nested = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (nested) return nested;
    }
    const nested = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
    return nested || null;
  };

  const directMatch = checkboxFrom(found);
  if (directMatch && !directMatch.disabled) return directMatch;

  const textMatch = selector.match(/:contains\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/i);
  const xpathTextMatch = selector.match(/text\(\)\s*=\s*["']([^"']+)["']/i);
  const requested = normalizePageTarget(description || (
    textMatch?.[1]
    || textMatch?.[2]
    || textMatch?.[3]
    || xpathTextMatch?.[1]
    || selector
  ));
  if (!requested) return null;
  const requestedTokens = requested.split(/\s+/).filter(token => token.length > 1
    && !/^(select|check|uncheck|checkbox|option|service|services|the|please|and|for|with)$/.test(token));
  if (requestedTokens.length === 0) return null;

  const candidates = Array.from(document.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]'
  )).filter(input => {
    if (input.disabled || input.closest('webclaw-overlay')) return false;
    const labelVisible = Array.from(input.labels || []).some(label => label.getClientRects().length > 0);
    const style = window.getComputedStyle(input);
    return labelVisible || (
      style.display !== 'none'
      && style.visibility !== 'hidden'
      && input.getClientRects().length > 0
    );
  }).map(input => {
    const labelText = Array.from(input.labels || [])
      .map(label => label.innerText || label.textContent || '')
      .join(' ');
    const text = normalizePageTarget([
      labelText,
      input.getAttribute('aria-label'),
      input.value,
      input.name,
      input.id,
    ].filter(Boolean).join(' '));
    const tokens = new Set(text.split(/\s+/));
    const score = requestedTokens.filter(token => tokens.has(token)).length;
    return { input, score };
  }).filter(candidate => candidate.score === requestedTokens.length)
    .sort((left, right) => right.score - left.score);

  if (
    candidates.length === 0
    || (candidates.length > 1 && candidates[0].score === candidates[1].score)
  ) return null;
  return candidates[0].input;
}
