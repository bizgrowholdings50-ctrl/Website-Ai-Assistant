/**
 * WebClaw DOM Snapshot
 * Captures a simplified, token-efficient DOM representation for the agent.
 */

interface SnapshotNode {
  tag: string;
  attrs?: Record<string, string>;
  text?: string;
  children?: SnapshotNode[];
}

const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'details', 'summary',
  'label', 'form', 'dialog',
]);

const SEMANTIC_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'nav', 'main', 'header', 'footer',
  'article', 'section', 'aside', 'p', 'ul', 'ol', 'li', 'table', 'img',
]);

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'svg', 'path', 'meta', 'link',
  'webclaw-overlay', // Don't snapshot ourselves
]);

const IMPORTANT_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'placeholder', 'aria-label',
  'type', 'name', 'id', 'role', 'value', 'action', 'method',
  'data-testid', 'data-cy', // Common test selectors
]);

/**
 * Capture a simplified DOM snapshot.
 * Returns a compact text representation suitable for LLM context.
 */
export function captureSnapshot(maxLength: number = 4000): string {
  const tree = walkNode(document.body, 0, 3);
  const text = serializeTree(tree);
  return text.substring(0, maxLength);
}

/**
 * Capture a snapshot focusing only on interactive elements.
 * Returns a smaller, more focused snapshot for the agent.
 */
export function captureInteractiveSnapshot(maxLength: number = 3000): string {
  const tree = walkInteractiveNode(document.body, 0, 4);
  const text = serializeTree(tree);
  return text.substring(0, maxLength);
}

function walkNode(node: Node, depth: number, maxDepth: number): SnapshotNode | null {
  if (depth > maxDepth) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').trim();
    if (text.length > 0 && text.length < 200) {
      return { tag: '#text', text };
    }
    return null;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (SKIP_TAGS.has(tag)) return null;
  if (el.getAttribute('aria-hidden') === 'true') return null;
  if (el.closest('[aria-hidden="true"]')) return null;

  // For non-semantic, non-interactive tags at depth, just grab text
  const isImportant = INTERACTIVE_TAGS.has(tag) || SEMANTIC_TAGS.has(tag);

  const result: SnapshotNode = { tag };

  // Collect important attributes
  const attrs: Record<string, string> = {};
  for (const attr of IMPORTANT_ATTRS) {
    const val = el.getAttribute(attr);
    if (val) attrs[attr] = val.substring(0, 100);
  }
  if (Object.keys(attrs).length > 0) result.attrs = attrs;

  // Process children
  const children: SnapshotNode[] = [];
  const childDepth = isImportant ? depth : depth + 1;

  // Check for shadow DOM
  if (el.shadowRoot) {
    for (const child of el.shadowRoot.childNodes) {
      const childNode = walkNode(child, childDepth, maxDepth);
      if (childNode) children.push(childNode);
    }
  }

  for (const child of el.childNodes) {
    const childNode = walkNode(child, childDepth, maxDepth);
    if (childNode) children.push(childNode);
  }

  if (children.length > 0) {
    result.children = children;
  } else if (!isImportant) {
    // Skip empty non-important nodes
    const text = (el.textContent || '').trim();
    if (text.length > 0 && text.length < 200) {
      result.text = text;
    } else {
      return null;
    }
  }

  return result;
}

/**
 * Walk only interactive elements for a focused snapshot.
 */
function walkInteractiveNode(node: Node, depth: number, maxDepth: number): SnapshotNode | null {
  if (depth > maxDepth) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').trim();
    if (text.length > 0 && text.length < 200) {
      return { tag: '#text', text };
    }
    return null;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (SKIP_TAGS.has(tag)) return null;
  if (el.getAttribute('aria-hidden') === 'true') return null;
  if (el.closest('[aria-hidden="true"]')) return null;

  const isInteractive = INTERACTIVE_TAGS.has(tag);
  if (!isInteractive && tag !== 'body' && tag !== 'html') {
    // Skip non-interactive unless it contains interactive children
    let hasInteractiveChild = false;
    for (const child of el.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childTag = (child as Element).tagName.toLowerCase();
        if (INTERACTIVE_TAGS.has(childTag)) {
          hasInteractiveChild = true;
          break;
        }
      }
    }
    if (!hasInteractiveChild) return null;
  }

  const result: SnapshotNode = { tag };

  // Collect important attributes
  const attrs: Record<string, string> = {};
  for (const attr of IMPORTANT_ATTRS) {
    const val = el.getAttribute(attr);
    if (val) attrs[attr] = val.substring(0, 100);
  }
  if (Object.keys(attrs).length > 0) result.attrs = attrs;

  // Process children
  const children: SnapshotNode[] = [];

  // Check for shadow DOM
  if (el.shadowRoot) {
    for (const child of el.shadowRoot.childNodes) {
      const childNode = walkInteractiveNode(child, depth + 1, maxDepth);
      if (childNode) children.push(childNode);
    }
  }

  for (const child of el.childNodes) {
    const childNode = walkInteractiveNode(child, depth + 1, maxDepth);
    if (childNode) children.push(childNode);
  }

  if (children.length > 0) {
    result.children = children;
  } else if (isInteractive) {
    const text = (el.textContent || '').trim();
    if (text.length > 0 && text.length < 200) {
      result.text = text;
    }
  }

  return result;
}

function serializeTree(node: SnapshotNode | null, indent: number = 0): string {
  if (!node) return '';

  const pad = '  '.repeat(indent);

  if (node.tag === '#text') {
    return `${pad}${node.text}\n`;
  }

  let line = `${pad}<${node.tag}`;
  if (node.attrs) {
    for (const [k, v] of Object.entries(node.attrs)) {
      line += ` ${k}="${v}"`;
    }
  }
  line += '>';

  if (node.text && !node.children) {
    return `${line}${node.text}</${node.tag}>\n`;
  }

  let result = line + '\n';
  if (node.children) {
    for (const child of node.children) {
      result += serializeTree(child, indent + 1);
    }
  }
  return result;
}
