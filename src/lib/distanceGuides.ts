import type { InterfaceKitController, InterfaceKitSnapshot } from 'interface-kit';

import { measureDistances, type DistanceMark } from './distanceGeometry.js';
import { hitTest, isInsideKitUi } from './kitDom.js';
import type { AlignRect } from './snapGeometry.js';

const STYLE_ID = 'interface-kit-distance-styles';
const SVG_NS = 'http://www.w3.org/2000/svg';
const POINTER_MOVE = { capture: true, passive: true } as const;

const DISTANCE_CSS = `[data-ik-distance] {
  position: fixed;
  inset: 0;
  z-index: 99998;
  pointer-events: none;
  display: none;
  overflow: hidden;
}
[data-ik-distance] [data-ik-hover-box] {
  position: absolute;
  border: 1px solid #60a5fa;
  box-sizing: border-box;
}
[data-ik-distance] line {
  stroke: #2563eb;
  stroke-width: 1;
}
[data-ik-distance] [data-ik-label] {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 1px 5px;
  border-radius: 4px;
  background: #2563eb;
  color: #fff;
  font: 500 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
`;

/**
 * Selection held, Alt + hover another element: distance lines and a px label.
 * Overlay only — writing gap/margin is a later, explicit apply.
 */
export function enableDistanceGuides(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;
  const overlay = createOverlay(doc);
  const styleEl = ensureStyles(doc);
  doc.body.append(overlay);

  let kitActive = false;
  let editingText = false;
  let dragging = false;
  let altDown = false;
  let pointer = { x: 0, y: 0 };
  let frame = 0;

  const unsubscribe = controller.subscribe(onSnapshot);
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
    dragging = snapshot.isDraggingStyle;
    sync();
  }

  function canMeasure(): boolean {
    return kitActive && !editingText && !dragging && altDown;
  }

  function sync(): void {
    if (canMeasure() && controller.getSelectedElement()) {
      if (frame === 0) frame = win.requestAnimationFrame(tick);
      return;
    }
    stop();
  }

  function tick(): void {
    frame = 0;
    const selected = controller.getSelectedElement();
    if (!canMeasure() || !selected) {
      hide();
      return;
    }

    const hovered = hitTest(doc, pointer.x, pointer.y);
    if (!hovered || hovered === selected) {
      hide();
      frame = win.requestAnimationFrame(tick);
      return;
    }

    place(
      overlay,
      toRect(hovered.getBoundingClientRect()),
      measureDistances(toRect(selected.getBoundingClientRect()), toRect(hovered.getBoundingClientRect())),
    );
    frame = win.requestAnimationFrame(tick);
  }

  function stop(): void {
    if (frame !== 0) {
      win.cancelAnimationFrame(frame);
      frame = 0;
    }
    hide();
  }

  function hide(): void {
    overlay.style.display = 'none';
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Alt') return;
    altDown = true;
    sync();
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.key !== 'Alt') return;
    altDown = false;
    sync();
  }

  function onPointerMove(event: PointerEvent): void {
    pointer = { x: event.clientX, y: event.clientY };
    if (!altDown || isInsideKitUi(event)) return;
    sync();
  }

  function onBlur(): void {
    altDown = false;
    sync();
  }

  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('keyup', onKeyUp, true);
  win.addEventListener('blur', onBlur);
  doc.addEventListener('pointermove', onPointerMove, POINTER_MOVE);

  return () => {
    unsubscribe();
    stop();
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('keyup', onKeyUp, true);
    win.removeEventListener('blur', onBlur);
    doc.removeEventListener('pointermove', onPointerMove, POINTER_MOVE);
    overlay.remove();
    styleEl.remove();
  };
}

function toRect(box: DOMRect): AlignRect {
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function createOverlay(doc: Document): HTMLDivElement {
  const root = doc.createElement('div');
  root.setAttribute('data-interface-kit', '');
  root.setAttribute('data-ik-distance', '');
  root.setAttribute('aria-hidden', 'true');

  const hoverBox = doc.createElement('div');
  hoverBox.setAttribute('data-ik-hover-box', '');
  root.append(hoverBox);

  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  root.append(svg);

  const labels = doc.createElement('div');
  labels.setAttribute('data-ik-labels', '');
  root.append(labels);

  return root;
}

function ensureStyles(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = DISTANCE_CSS;
  doc.head.append(style);
  return style;
}

function place(overlay: HTMLDivElement, hover: AlignRect, marks: DistanceMark[]): void {
  const box = overlay.querySelector('[data-ik-hover-box]');
  const svg = overlay.querySelector('svg');
  const labels = overlay.querySelector('[data-ik-labels]');
  if (!(box instanceof HTMLElement) || !svg || !(labels instanceof HTMLElement)) return;

  box.style.left = `${hover.left}px`;
  box.style.top = `${hover.top}px`;
  box.style.width = `${hover.width}px`;
  box.style.height = `${hover.height}px`;

  svg.replaceChildren();
  labels.replaceChildren();

  for (const mark of marks) {
    const line = overlay.ownerDocument.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(mark.x1));
    line.setAttribute('y1', String(mark.y1));
    line.setAttribute('x2', String(mark.x2));
    line.setAttribute('y2', String(mark.y2));
    svg.append(line);

    const label = overlay.ownerDocument.createElement('div');
    label.setAttribute('data-ik-label', '');
    label.textContent = `${mark.px}px`;
    const cx = (mark.x1 + mark.x2) / 2;
    const cy = (mark.y1 + mark.y2) / 2;
    label.style.left = `${cx + (mark.axis === 'x' ? 0 : 12)}px`;
    label.style.top = `${cy + (mark.axis === 'x' ? -10 : 0)}px`;
    labels.append(label);
  }

  overlay.style.display = 'block';
}
