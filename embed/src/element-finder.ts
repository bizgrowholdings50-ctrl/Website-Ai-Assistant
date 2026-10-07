/**
 * WebClaw Element Finder
 * Shared utility for finding DOM elements using multiple strategies.
 */

/**
 * Find an element using multiple strategies:
 * 1. Direct CSS selector
 * 2. aria-label attribute
 * 3. Text content search (buttons, links, labels)
 * 4. data-testid and data-cy attributes (common test selectors)
 */
export function findElement(selector: string): Element | null {
  if (typeof selector !== 'string') return null;
  const normalizedSelector = selector.trim();
  if (!normalizedSelector) return null;

  // Try direct CSS selector first
  let el: Element | null = null;
  try {
    el = document.querySelector(normalizedSelector);
  } catch {
    // Agent selectors can also be human-readable labels, not valid CSS.
  }
  if (el) return el;

  // Compare attributes directly so quotes or CSS punctuation in labels are safe.
  for (const candidate of document.querySelectorAll('[aria-label], [data-testid], [data-cy]')) {
    if (
      candidate.getAttribute('aria-label') === normalizedSelector
      || candidate.getAttribute('data-testid') === normalizedSelector
      || candidate.getAttribute('data-cy') === normalizedSelector
    ) {
      return candidate;
    }
  }

  // Text content search (buttons, links, labels, inputs)
  const candidates = document.querySelectorAll(
    'a, button, [role="button"], label, input, [role="link"]'
  );
  for (const c of candidates) {
    if (c.textContent?.trim().toLowerCase().includes(normalizedSelector.toLowerCase())) {
      return c;
    }
  }

  return null;
}

/**
 * Find an element with retry logic (for elements that might not be in DOM yet).
 * Useful when the element is being loaded asynchronously.
 */
export function findElementWithRetry(
  selector: string,
  maxAttempts: number = 5,
  delayMs: number = 100
): Promise<Element | null> {
  return new Promise((resolve) => {
    if (typeof selector !== 'string' || !selector.trim()) {
      resolve(null);
      return;
    }

    let attempts = 0;

    const tryFind = () => {
      const el = findElement(selector);
      if (el) {
        resolve(el);
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryFind, delayMs);
      } else {
        resolve(null);
      }
    };

    tryFind();
  });
}
