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
  // Try direct CSS selector first
  let el = document.querySelector(selector);
  if (el) return el;

  // Try aria-label
  el = document.querySelector(`[aria-label="${selector}"]`);
  if (el) return el;

  // Try data-testid
  el = document.querySelector(`[data-testid="${selector}"]`);
  if (el) return el;

  // Try data-cy
  el = document.querySelector(`[data-cy="${selector}"]`);
  if (el) return el;

  // Text content search (buttons, links, labels, inputs)
  const candidates = document.querySelectorAll(
    'a, button, [role="button"], label, input, [role="link"]'
  );
  for (const c of candidates) {
    if (c.textContent?.trim().toLowerCase().includes(selector.toLowerCase())) {
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
