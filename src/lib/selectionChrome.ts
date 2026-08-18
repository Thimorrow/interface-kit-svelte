import type { InterfaceKitController, InterfaceKitSnapshot } from 'interface-kit';

import {
  getApplyScope,
  setApplyScope,
  subscribeApplyScope,
  type ApplyScope,
} from './applyScope.js';
import {
  ancestryChain,
  hostLabel,
  similarElements,
} from './kitDom.js';
import { chromeHint } from './kitModifiers.js';
import { selectHostElement } from './kitSelect.js';
import {
  getStyleState,
  setStyleState,
  subscribeStyleState,
  type KitStyleState,
} from './styleState.js';

const STATES: KitStyleState[] = ['rest', 'hover', 'focus'];
const STYLE_ID = 'interface-kit-chrome-styles';

const CHROME_CSS = `[data-ik-chrome] {
  position: fixed;
  z-index: 100000;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
  font: 500 11px/1.2 ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
[data-ik-chrome] [data-ik-bar] {
  display: flex;
  align-items: center;
  padding: 3px;
  border-radius: 9px;
  background: #2a2a2a;
  box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.5);
}
[data-ik-chrome] button {
  margin: 0;
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
}
[data-ik-chrome] button[aria-pressed="true"],
[data-ik-chrome] button[aria-current="true"] {
  background: #363636;
  color: #fff;
}
[data-ik-chrome] [data-ik-path] button {
  padding: 5px 7px;
}
[data-ik-chrome] [data-ik-sep] {
  color: rgba(255, 255, 255, 0.28);
  padding: 0 1px;
  font-size: 10px;
  pointer-events: none;
}
[data-ik-chrome] [data-ik-split] {
  width: 1px;
  align-self: stretch;
  margin: 3px 4px;
  background: rgba(255, 255, 255, 0.12);
}
[data-ik-chrome] [data-ik-hint] {
  color: rgba(255, 255, 255, 0.45);
  font: 500 10px/1.2 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.01em;
  pointer-events: none;
}
@media (hover: hover) and (pointer: fine) {
  [data-ik-chrome] button:hover {
    color: #fff;
  }
}
[data-ik-chrome] button:active {
  transform: scale(0.97);
}
`;

/**
 * Path, Rest/Hover/Focus, This/All, and a one-line hint on the selection
 * rect. Parent/child is Escape/Enter; the path makes that visible.
 */
export function enableSelectionChrome(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;
  const chrome = createChrome(doc);
  const styleEl = ensureStyle(doc);
  doc.body.append(chrome.root);
  const { path: pathBar, states: stateBar, scope: scopeBar, hint: hintEl } = chrome;

  let kitActive = false;
  let editingText = false;
  let dragging = false;
  let overlayFrame = 0;

  const unsubscribe = controller.subscribe(onSnapshot);
  const unsubStyle = subscribeStyleState(() => syncButtons(stateBar, scopeBar));
  const unsubScope = subscribeApplyScope(() => syncButtons(stateBar, scopeBar));
  onSnapshot(controller.getState());
  syncButtons(stateBar, scopeBar);

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
    dragging = snapshot.isDraggingStyle;
    syncOverlay();
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
      chrome.root.style.display = 'none';
      return;
    }

    renderPath(pathBar, el);
    renderScope(scopeBar, el);
    hintEl.textContent = chromeHint(dragging);
    syncButtons(stateBar, scopeBar);

    const rect = el.getBoundingClientRect();
    const width = chrome.root.offsetWidth || 220;
    const height = chrome.root.offsetHeight || 64;
    const left = Math.min(
      win.innerWidth - width - 8,
      Math.max(8, rect.left + rect.width / 2 - width / 2),
    );
    const above = rect.top - height - 8;
    chrome.root.style.display = 'flex';
    chrome.root.style.left = `${left}px`;
    chrome.root.style.top = `${above > 8 ? above : rect.bottom + 10}px`;
    overlayFrame = win.requestAnimationFrame(tick);
  }

  function stopOverlay(): void {
    if (overlayFrame !== 0) {
      win.cancelAnimationFrame(overlayFrame);
      overlayFrame = 0;
    }
    chrome.root.style.display = 'none';
  }

  function onClick(event: MouseEvent): void {
    const btn = event.target;
    if (!(btn instanceof HTMLButtonElement)) return;
    event.preventDefault();
    event.stopPropagation();

    if (btn.dataset.state) {
      setStyleState(btn.dataset.state as KitStyleState);
      return;
    }
    if (btn.dataset.scope) {
      setApplyScope(btn.dataset.scope as ApplyScope);
      return;
    }
    const index = btn.dataset.pathIndex;
    if (index == null) return;
    const selected = controller.getSelectedElement();
    if (!selected) return;
    const chain = ancestryChain(selected);
    const target = chain[Number(index)];
    if (target) selectHostElement(controller, target);
  }

  chrome.root.addEventListener('click', onClick, true);
  chrome.root.addEventListener('pointerdown', (event) => event.stopPropagation(), true);

  return () => {
    unsubscribe();
    unsubStyle();
    unsubScope();
    stopOverlay();
    chrome.root.removeEventListener('click', onClick, true);
    chrome.root.remove();
    styleEl.remove();
  };
}

function renderPath(bar: HTMLElement, el: HTMLElement): void {
  const chain = ancestryChain(el);
  bar.replaceChildren();
  chain.forEach((node, index) => {
    if (index > 0) {
      const sep = bar.ownerDocument.createElement('span');
      sep.setAttribute('data-ik-sep', '');
      sep.textContent = '›';
      bar.append(sep);
    }
    const btn = bar.ownerDocument.createElement('button');
    btn.type = 'button';
    btn.dataset.pathIndex = String(index);
    btn.textContent = hostLabel(node);
    btn.setAttribute('aria-current', String(node === el));
    bar.append(btn);
  });
}

function renderScope(bar: HTMLElement, el: HTMLElement): void {
  const count = similarElements(el).length;
  bar.style.display = count > 0 ? 'flex' : 'none';
  const allBtn = bar.querySelector('[data-scope="all"]');
  if (allBtn) allBtn.textContent = count > 0 ? `All ${count + 1}` : 'All';
}

function syncButtons(stateBar: HTMLElement, scopeBar: HTMLElement): void {
  const state = getStyleState();
  for (const btn of stateBar.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.state === state));
  }
  const scope = getApplyScope();
  for (const btn of scopeBar.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.scope === scope));
  }
}

function createChrome(doc: Document): {
  root: HTMLDivElement;
  path: HTMLDivElement;
  states: HTMLDivElement;
  scope: HTMLDivElement;
  hint: HTMLDivElement;
} {
  const root = doc.createElement('div');
  root.setAttribute('data-interface-kit', '');
  root.setAttribute('data-ik-chrome', '');

  const path = doc.createElement('div');
  path.setAttribute('data-ik-bar', '');
  path.setAttribute('data-ik-path', '');
  path.setAttribute('aria-label', 'Selection path');
  root.append(path);

  const row = doc.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '6px';

  const states = doc.createElement('div');
  states.setAttribute('data-ik-bar', '');
  states.setAttribute('data-ik-states', '');
  states.setAttribute('role', 'group');
  states.setAttribute('aria-label', 'Element state');
  for (const state of STATES) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.dataset.state = state;
    btn.setAttribute('aria-pressed', String(state === 'rest'));
    btn.textContent = state === 'rest' ? 'Rest' : state === 'hover' ? 'Hover' : 'Focus';
    states.append(btn);
  }
  row.append(states);

  const scope = doc.createElement('div');
  scope.setAttribute('data-ik-bar', '');
  scope.setAttribute('data-ik-scope', '');
  scope.setAttribute('role', 'group');
  scope.setAttribute('aria-label', 'Apply to');
  for (const value of ['this', 'all'] as const) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.dataset.scope = value;
    btn.setAttribute('aria-pressed', String(value === 'all'));
    btn.textContent = value === 'this' ? 'This' : 'All';
    scope.append(btn);
  }
  row.append(scope);
  root.append(row);

  const hint = doc.createElement('div');
  hint.setAttribute('data-ik-hint', '');
  hint.textContent = chromeHint(false);
  root.append(hint);

  return { root, path, states, scope, hint };
}

function ensureStyle(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CHROME_CSS;
  doc.head.append(style);
  return style;
}
