const KIT_ATTR = 'data-interface-kit';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR', 'WBR']);

export function isKitNode(node: EventTarget | null): boolean {
  return node instanceof Element && node.hasAttribute(KIT_ATTR);
}

export function isInsideKitUi(event: Event): boolean {
  return event.composedPath().some(isKitNode);
}

export function isHostRoot(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return true;
  const tag = el.tagName;
  return tag === 'HTML' || tag === 'BODY';
}

export function isSelectableHost(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (isHostRoot(el)) return false;
  if (el.hasAttribute(KIT_ATTR)) return false;
  if (SKIP_TAGS.has(el.tagName)) return false;
  return true;
}

export function hitTest(doc: Document, x: number, y: number): HTMLElement | null {
  const stack = doc.elementsFromPoint(x, y);
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.hasAttribute(KIT_ATTR)) continue;
    if (node.closest(`[${KIT_ATTR}]`)) continue;
    if (SKIP_TAGS.has(node.tagName)) continue;
    return node;
  }
  return null;
}

export function selectableChildren(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const child of el.children) {
    if (!isSelectableHost(child)) continue;
    const box = child.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    out.push(child);
  }
  return out;
}

export function childToward(
  selected: HTMLElement,
  under: HTMLElement | null,
): HTMLElement | null {
  const children = selectableChildren(selected);
  if (children.length === 0) return null;
  if (under && selected.contains(under) && under !== selected) {
    let current: HTMLElement | null = under;
    while (current && current.parentElement !== selected) {
      current = current.parentElement;
    }
    if (current && children.includes(current)) return current;
  }
  return children[0] ?? null;
}

export function parentToward(selected: HTMLElement): HTMLElement | null {
  const parent = selected.parentElement;
  return isSelectableHost(parent) ? parent : null;
}
