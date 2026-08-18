import type { InterfaceKitController, InterfaceKitSnapshot } from 'interface-kit';

import {
  childToward,
  hitTest,
  isInsideKitUi,
  parentToward,
} from './kitDom.js';
import { selectHostElement } from './kitSelect.js';

/**
 * Drill the selection one DOM level at a time. Escape goes to the parent
 * wrapper (the node padding actually lives on). Enter or double-click goes
 * back into a child. Escape during a drag stays cancel — that handler runs
 * first and stops the event.
 */
export function enableSelectAncestry(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;
  let kitActive = false;
  let editingText = false;
  let dragging = false;
  let pointer = { x: 0, y: 0 };

  const unsubscribe = controller.subscribe(onSnapshot);
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
    dragging = snapshot.isDraggingStyle;
  }

  function onPointerMove(event: PointerEvent): void {
    pointer = { x: event.clientX, y: event.clientY };
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!kitActive || editingText || dragging) return;
    if (isInsideKitUi(event)) return;
    if (isTypingTarget(event.target)) return;

    if (event.key === 'Escape') {
      const selected = controller.getSelectedElement();
      if (!selected) return;
      const parent = parentToward(selected);
      if (!parent) return;
      event.preventDefault();
      event.stopPropagation();
      selectHostElement(controller, parent);
      return;
    }

    if (event.key !== 'Enter') return;
    const selected = controller.getSelectedElement();
    if (!selected) return;
    const next = childToward(selected, hitTest(doc, pointer.x, pointer.y));
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    selectHostElement(controller, next);
  }

  function onDoubleClick(event: MouseEvent): void {
    if (!kitActive || editingText || dragging) return;
    if (isInsideKitUi(event)) return;
    const selected = controller.getSelectedElement();
    if (!selected) return;
    const under = hitTest(doc, event.clientX, event.clientY);
    const next = childToward(selected, under);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    selectHostElement(controller, next);
  }

  const pointerMove = { capture: true, passive: true } as const;

  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('dblclick', onDoubleClick, true);
  doc.addEventListener('pointermove', onPointerMove, pointerMove);

  return () => {
    unsubscribe();
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('dblclick', onDoubleClick, true);
    doc.removeEventListener('pointermove', onPointerMove, pointerMove);
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}
