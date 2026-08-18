import type {
  InterfaceKitController,
  InterfaceKitSnapshot,
  StyleChange,
} from 'interface-kit';

import { tokenClass, tokenForValue } from './tokenColors.js';

export type KitStyleState = 'rest' | 'hover' | 'focus';

const STATES: KitStyleState[] = ['rest', 'hover', 'focus'];
const STYLE_ID = 'interface-kit-state-styles';
const PREVIEW_STYLE_ID = 'interface-kit-state-preview';
const SPATIAL = new Set(['translate', 'width', 'height']);

const SWITCHER_CSS = `[data-ik-state-switch] {
  position: fixed;
  z-index: 100000;
  display: none;
  pointer-events: auto;
  padding: 3px;
  border-radius: 9px;
  background: #2a2a2a;
  box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.5);
  font: 500 11px/1.2 ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
[data-ik-state-switch] button {
  margin: 0;
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
}
[data-ik-state-switch] button[aria-pressed="true"] {
  background: #363636;
  color: #fff;
}
@media (hover: hover) and (pointer: fine) {
  [data-ik-state-switch] button:hover {
    color: #fff;
  }
}
[data-ik-state-switch] button:active {
  transform: scale(0.97);
}
`;

let styleState: KitStyleState = 'rest';
const preview = new Map<string, Map<string, string>>();
let previewSerial = 0;

export function getStyleState(): KitStyleState {
  return styleState;
}

/**
 * Rest / Hover / Focus switcher on the selection rect. Inspector edits in
 * Hover/Focus land as hover: / focus: utilities so Copy as prompt can write
 * both states. Color values that match a :root token become var(--…).
 */
export function enableStyleState(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;
  const switcher = createSwitcher(doc);
  const switcherStyle = ensureStyle(doc, STYLE_ID, SWITCHER_CSS);
  const previewStyle = ensureStyle(doc, PREVIEW_STYLE_ID, '');
  doc.body.append(switcher);

  let kitActive = false;
  let editingText = false;
  let overlayFrame = 0;
  let rewriting = false;
  let previous: StyleChange[] = [];
  let selectedKey: string | null = null;
  let marked: HTMLElement | null = null;

  const unsubscribe = controller.subscribe(onSnapshot);
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
    const key = snapshot.selectedElement?.key ?? null;
    if (key !== selectedKey) {
      selectedKey = key;
      setState('rest', true);
    }
    if (!rewriting) rewritePending(snapshot);
    syncOverlay();
  }

  function setState(next: KitStyleState, silent = false): void {
    if (styleState === next && silent) {
      applyPreviewAttr(controller.getSelectedElement());
      return;
    }
    styleState = next;
    for (const btn of switcher.querySelectorAll('button')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.state === next));
    }
    applyPreviewAttr(controller.getSelectedElement());
  }

  function applyPreviewAttr(el: HTMLElement | null): void {
    if (marked && marked !== el) marked.removeAttribute('data-ik-state');
    marked = el;
    if (!el) return;
    if (styleState === 'rest') el.removeAttribute('data-ik-state');
    else el.setAttribute('data-ik-state', styleState);
    ensurePreviewId(el);
    writePreviewSheet(previewStyle);
  }

  function rewritePending(snapshot: InterfaceKitSnapshot): void {
    const el = controller.getSelectedElement();
    const info = snapshot.selectedElement;
    if (!el || !info) {
      previous = snapshot.pendingChanges;
      return;
    }

    rewriting = true;
    try {
      for (const change of snapshot.pendingChanges) {
        if (change.elementInfo.selector !== info.selector) continue;
        const unchanged = previous.some(
          (item) =>
            item.id === change.id &&
            item.newValue === change.newValue &&
            item.tailwindClass === change.tailwindClass,
        );
        if (unchanged) continue;
        const token = tokenForValue(doc, change.property, change.newValue);
        let value = change.newValue;
        let tw = change.tailwindClass;
        if (token) {
          value = `var(${token})`;
          tw = tokenClass(change.property, token);
        }

        const alreadyPseudo = change.property.includes(':');
        if (
          styleState !== 'rest' &&
          !alreadyPseudo &&
          !SPATIAL.has(change.property)
        ) {
          const prevRest = previous.find(
            (item) =>
              item.elementInfo.selector === change.elementInfo.selector &&
              item.property === change.property,
          );
          const pseudo = `${styleState}:${change.property}`;
          controller.applyStyleGroup(
            [el],
            pseudo,
            value,
            prefixTw(tw ?? fallbackClass(change.property, value), styleState),
            info,
          );
          rememberPreview(el, styleState, change.property, value);
          if (
            prevRest &&
            prevRest.newValue !== change.newValue &&
            !prevRest.property.includes(':')
          ) {
            controller.applyStyleGroup(
              [el],
              change.property,
              prevRest.newValue,
              prevRest.tailwindClass,
              info,
            );
          } else {
            controller.revertPropertyGroup([el], change.property, info);
          }
          continue;
        }

        if (token && change.newValue !== value) {
          controller.applyStyleGroup([el], change.property, value, tw, info);
        }
      }
    } finally {
      rewriting = false;
      previous = controller.getState().pendingChanges;
      writePreviewSheet(previewStyle);
    }
  }

  function canShow(): boolean {
    return kitActive && !editingText && Boolean(controller.getSelectedElement());
  }

  function syncOverlay(): void {
    if (canShow()) {
      if (overlayFrame === 0) overlayFrame = win.requestAnimationFrame(tick);
      return;
    }
    stopOverlay();
  }

  function tick(): void {
    overlayFrame = 0;
    const el = controller.getSelectedElement();
    if (!canShow() || !el) {
      switcher.style.display = 'none';
      return;
    }
    applyPreviewAttr(el);
    const rect = el.getBoundingClientRect();
    const width = switcher.offsetWidth || 168;
    const left = Math.min(
      win.innerWidth - width - 8,
      Math.max(8, rect.left + rect.width / 2 - width / 2),
    );
    const above = rect.top - 36;
    switcher.style.display = 'flex';
    switcher.style.left = `${left}px`;
    switcher.style.top = `${above > 8 ? above : rect.bottom + 10}px`;
    overlayFrame = win.requestAnimationFrame(tick);
  }

  function stopOverlay(): void {
    if (overlayFrame !== 0) {
      win.cancelAnimationFrame(overlayFrame);
      overlayFrame = 0;
    }
    switcher.style.display = 'none';
  }

  function onClick(event: MouseEvent): void {
    const btn = event.target;
    if (!(btn instanceof HTMLButtonElement) || !btn.dataset.state) return;
    event.preventDefault();
    event.stopPropagation();
    setState(btn.dataset.state as KitStyleState);
  }

  switcher.addEventListener('click', onClick, true);
  switcher.addEventListener('pointerdown', (event) => event.stopPropagation(), true);

  return () => {
    unsubscribe();
    stopOverlay();
    if (marked) marked.removeAttribute('data-ik-state');
    switcher.removeEventListener('click', onClick, true);
    switcher.remove();
    switcherStyle.remove();
    previewStyle.remove();
    styleState = 'rest';
    preview.clear();
  };
}

function prefixTw(cls: string, state: KitStyleState): string {
  if (state === 'rest') return cls;
  return cls
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.startsWith(`${state}:`) ? part : `${state}:${part}`))
    .join(' ');
}

function fallbackClass(property: string, value: string): string {
  if (property === 'background-color') return `bg-[${value}]`;
  if (property === 'color') return `text-[${value}]`;
  if (property === 'border-color') return `border-[${value}]`;
  return `[${property}:${value}]`;
}

function ensurePreviewId(el: HTMLElement): string {
  let id = el.getAttribute('data-ik-preview-id');
  if (id) return id;
  id = `ikp-${++previewSerial}`;
  el.setAttribute('data-ik-preview-id', id);
  return id;
}

function rememberPreview(
  el: HTMLElement,
  state: KitStyleState,
  property: string,
  value: string,
): void {
  const id = ensurePreviewId(el);
  const key = `${id}:${state}`;
  let rules = preview.get(key);
  if (!rules) {
    rules = new Map();
    preview.set(key, rules);
  }
  rules.set(property, value);
}

function writePreviewSheet(style: HTMLStyleElement): void {
  const chunks: string[] = [];
  for (const [key, rules] of preview) {
    const sep = key.lastIndexOf(':');
    const id = key.slice(0, sep);
    const state = key.slice(sep + 1);
    const body = [...rules.entries()]
      .map(([property, value]) => `${property}: ${value} !important`)
      .join('; ');
    if (!body) continue;
    chunks.push(`[data-ik-preview-id="${id}"][data-ik-state="${state}"] { ${body}; }`);
  }
  style.textContent = chunks.join('\n');
}

function createSwitcher(doc: Document): HTMLDivElement {
  const bar = doc.createElement('div');
  bar.setAttribute('data-interface-kit', '');
  bar.setAttribute('data-ik-state-switch', '');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Element state');
  for (const state of STATES) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.dataset.state = state;
    btn.setAttribute('aria-pressed', String(state === 'rest'));
    btn.textContent = labelFor(state);
    bar.append(btn);
  }
  return bar;
}

function labelFor(state: KitStyleState): string {
  if (state === 'rest') return 'Rest';
  if (state === 'hover') return 'Hover';
  return 'Focus';
}

function ensureStyle(doc: Document, id: string, css: string): HTMLStyleElement {
  const existing = doc.getElementById(id);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = css;
  doc.head.append(style);
  return style;
}
