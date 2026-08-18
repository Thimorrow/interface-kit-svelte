import type { InterfaceKitController } from 'interface-kit';

/**
 * The package has no public select API. Clicking while something is already
 * selected only clears. So we wait for that clear, then dispatch a click with
 * elementFromPoint patched to the target — the same path the inspector uses.
 */
export function selectHostElement(
  controller: InterfaceKitController,
  el: HTMLElement,
): void {
  if (!el.isConnected) return;
  if (controller.getSelectedElement() === el) return;

  const fire = () => clickAsKit(el);

  if (!controller.getState().selectedElement) {
    fire();
    return;
  }

  const unsub = controller.subscribe((snapshot) => {
    if (snapshot.selectedElement) return;
    unsub();
    fire();
  });
  controller.clearSelection();
}

function clickAsKit(el: HTMLElement): void {
  const doc = el.ownerDocument;
  const box = el.getBoundingClientRect();
  const x = box.left + Math.min(8, Math.max(1, box.width / 2));
  const y = box.top + Math.min(8, Math.max(1, box.height / 2));
  const original = doc.elementFromPoint.bind(doc);

  doc.elementFromPoint = () => el;
  try {
    el.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: doc.defaultView ?? window,
        clientX: x,
        clientY: y,
      }),
    );
  } finally {
    doc.elementFromPoint = original;
  }
}
