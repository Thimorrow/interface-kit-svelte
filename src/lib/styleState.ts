import type {
  InterfaceKitController,
  InterfaceKitSnapshot,
  StyleChange,
} from 'interface-kit';

import { tokenClass, tokenForValue } from './tokenColors.js';

export type KitStyleState = 'rest' | 'hover' | 'focus';

const PREVIEW_STYLE_ID = 'interface-kit-state-preview';
const SPATIAL = new Set(['translate', 'width', 'height']);

let styleState: KitStyleState = 'rest';
const listeners = new Set<() => void>();
const preview = new Map<string, Map<string, string>>();
let previewSerial = 0;

export function getStyleState(): KitStyleState {
  return styleState;
}

export function setStyleState(next: KitStyleState): void {
  if (styleState === next) return;
  styleState = next;
  for (const listener of listeners) listener();
}

export function subscribeStyleState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Inspector edits in Hover/Focus land as hover: / focus: utilities so
 * Copy as prompt can write both states. Color values that match a :root
 * token become var(--…). The Rest/Hover/Focus buttons live on the
 * selection chrome.
 */
export function enableStyleState(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const previewStyle = ensureStyle(doc, PREVIEW_STYLE_ID, '');

  let rewriting = false;
  let previous: StyleChange[] = [];
  let selectedKey: string | null = null;
  let marked: HTMLElement | null = null;

  const unsubscribe = controller.subscribe(onSnapshot);
  const unsubState = subscribeStyleState(() => {
    applyPreviewAttr(controller.getSelectedElement());
  });
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    const key = snapshot.selectedElement?.key ?? null;
    if (key !== selectedKey) {
      selectedKey = key;
      setStyleState('rest');
    }
    if (!rewriting) rewritePending(snapshot);
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

  return () => {
    unsubscribe();
    unsubState();
    if (marked) marked.removeAttribute('data-ik-state');
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

function ensureStyle(doc: Document, id: string, css: string): HTMLStyleElement {
  const existing = doc.getElementById(id);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = css;
  doc.head.append(style);
  return style;
}
