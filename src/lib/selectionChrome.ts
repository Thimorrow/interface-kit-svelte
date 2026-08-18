import type { InterfaceKitController, InterfaceKitSnapshot } from 'interface-kit';

import {
  getApplyScope,
  setApplyScope,
  subscribeApplyScope,
  type ApplyScope,
} from './applyScope.js';
import { similarElements } from './kitDom.js';
import {
  getStyleState,
  setStyleState,
  subscribeStyleState,
  type KitStyleState,
} from './styleState.js';

const STATES: KitStyleState[] = ['rest', 'hover'];
const STYLE_ID = 'interface-kit-chrome-styles';

const CHROME_CSS = `[data-ik-chrome] {
  position: fixed;
  z-index: 100000;
  display: none;
  flex-direction: row;
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
[data-ik-chrome] button[aria-pressed="true"] {
  background: #363636;
  color: #fff;
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
 * Rest/Hover and This/All on the selection. Parent/child is Escape/Enter.
 */
export function enableSelectionChrome(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;
  const chrome = createChrome(doc);
  const styleEl = ensureStyle(doc);
  doc.body.append(chrome.root);
  const { states: stateBar, scope: scopeBar } = chrome;

  let kitActive = false;
  let editingText = false;
  let overlayFrame = 0;

  const unsubscribe = controller.subscribe(onSnapshot);
  const unsubStyle = subscribeStyleState(() => syncButtons(stateBar, scopeBar));
  const unsubScope = subscribeApplyScope(() => syncButtons(stateBar, scopeBar));
  onSnapshot(controller.getState());
  syncButtons(stateBar, scopeBar);

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
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

    renderScope(scopeBar, el);
    syncButtons(stateBar, scopeBar);

    const rect = el.getBoundingClientRect();
    const width = chrome.root.offsetWidth || 180;
    const height = chrome.root.offsetHeight || 32;
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
    }
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
  states: HTMLDivElement;
  scope: HTMLDivElement;
} {
  const root = doc.createElement('div');
  root.setAttribute('data-interface-kit', '');
  root.setAttribute('data-ik-chrome', '');

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
    btn.textContent = state === 'rest' ? 'Rest' : 'Hover';
    states.append(btn);
  }
  root.append(states);

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
  root.append(scope);

  return { root, states, scope };
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
