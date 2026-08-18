import type {
  ElementInfo,
  InterfaceKitController,
  InterfaceKitSnapshot,
  StyleChange,
} from 'interface-kit';

import { similarElements } from './kitDom.js';

export type ApplyScope = 'this' | 'all';

const SPATIAL = new Set(['translate', 'width', 'height']);
const DUMMY: ElementInfo = {
  key: '__ik-scope__',
  name: '',
  path: '',
  tag: '',
  id: null,
  classes: [],
  textContent: '',
  selector: '__ik-scope__',
  similarCount: 0,
};

let applyScope: ApplyScope = 'all';
const listeners = new Set<() => void>();

export function getApplyScope(): ApplyScope {
  return applyScope;
}

export function setApplyScope(next: ApplyScope): void {
  if (applyScope === next) return;
  applyScope = next;
  for (const listener of listeners) listener();
}

export function subscribeApplyScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Inspector applyStyle always paints similar elements. This mode keeps the
 * pending change on the selected node and restores the others. All is the
 * package default.
 */
export function enableApplyScope(
  controller: InterfaceKitController,
  _doc: Document,
): () => void {
  let previous: StyleChange[] = [];
  let dragging = false;
  let rewriting = false;

  const unsubscribe = controller.subscribe(onSnapshot);
  const unsubScope = subscribeApplyScope(() => {
    const snapshot = controller.getState();
    if (applyScope === 'this') stripSimilar(snapshot);
    else paintSimilar(snapshot);
  });
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    const wasDragging = dragging;
    dragging = snapshot.isDraggingStyle;
    if (rewriting) return;

    const changed =
      snapshot.pendingChanges.length !== previous.length ||
      snapshot.pendingChanges.some((change, index) => {
        const item = previous[index];
        return (
          !item ||
          item.id !== change.id ||
          item.newValue !== change.newValue ||
          item.tailwindClass !== change.tailwindClass
        );
      });

    if (applyScope === 'this' && (changed || (wasDragging && !dragging))) {
      stripSimilar(snapshot);
    }
    previous = snapshot.pendingChanges;
  }

  function stripSimilar(snapshot: InterfaceKitSnapshot): void {
    const el = controller.getSelectedElement();
    const info = snapshot.selectedElement;
    if (!el || !info) return;

    const others = similarElements(el);
    if (others.length === 0) return;

    const properties = snapshot.pendingChanges
      .filter(
        (change) =>
          change.elementInfo.selector === info.selector &&
          !SPATIAL.has(change.property),
      )
      .map((change) => change.property);

    if (properties.length === 0) return;

    rewriting = true;
    try {
      for (const property of new Set(properties)) {
        controller.revertPropertyGroup(others, property, DUMMY);
      }
    } finally {
      rewriting = false;
    }
  }

  function paintSimilar(snapshot: InterfaceKitSnapshot): void {
    const el = controller.getSelectedElement();
    const info = snapshot.selectedElement;
    if (!el || !info) return;
    const others = similarElements(el);
    if (others.length === 0) return;

    rewriting = true;
    try {
      for (const change of snapshot.pendingChanges) {
        if (change.elementInfo.selector !== info.selector) continue;
        if (SPATIAL.has(change.property)) continue;
        controller.applyStyleGroup(
          [el, ...others],
          change.property,
          change.newValue,
          change.tailwindClass,
          info,
        );
      }
    } finally {
      rewriting = false;
    }
  }

  return () => {
    unsubscribe();
    unsubScope();
    applyScope = 'all';
    previous = [];
  };
}
