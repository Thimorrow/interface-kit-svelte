import type { InterfaceKitController, InterfaceKitSnapshot } from 'interface-kit';

import { styleFromDistance, spaceClass } from './distanceApply.js';
import { measureDistances, type DistanceMark } from './distanceGeometry.js';
import { hitTest, isFlexOrGrid, isInsideKitUi, parentToward } from './kitDom.js';
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
  pointer-events: auto;
  cursor: pointer;
}
@media (hover: hover) and (pointer: fine) {
  [data-ik-distance] [data-ik-label]:hover {
    background: #1d4ed8;
  }
}
[data-ik-distance] [data-ik-label]:active {
  transform: translate(-50%, -50%) scale(0.97);
}
`;

type Measure = {
  selected: HTMLElement;
  hovered: HTMLElement;
  selectedRect: AlignRect;
  hoveredRect: AlignRect;
  marks: DistanceMark[];
};

/**
 * Selection held, hover another element: distance lines and a px label.
 * Click the label to write margin or padding. Shift-click writes gap on a
 * flex/grid parent. No modifier — Alt is Option on Mac and nobody holds it.
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
  let pointer = { x: 0, y: 0 };
  let frame = 0;
  let measure: Measure | null = null;

  const unsubscribe = controller.subscribe(onSnapshot);
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
    dragging = snapshot.isDraggingStyle;
    sync();
  }

  function canMeasure(): boolean {
    return kitActive && !editingText && !dragging;
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

    const selectedRect = toRect(selected.getBoundingClientRect());
    const hoveredRect = toRect(hovered.getBoundingClientRect());
    const marks = measureDistances(selectedRect, hoveredRect);
    measure = { selected, hovered, selectedRect, hoveredRect, marks };
    place(overlay, hoveredRect, marks);
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
    measure = null;
  }

  function onPointerMove(event: PointerEvent): void {
    if (isLabel(event)) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (isInsideKitUi(event) && !isLabel(event)) return;
    sync();
  }

  function onClick(event: MouseEvent): void {
    const label = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.hasAttribute('data-ik-label'),
      );
    if (!label || !measure) return;
    const index = Number(label.dataset.mark);
    const mark = measure.marks[index];
    if (!mark) return;

    event.preventDefault();
    event.stopPropagation();
    applyMark(controller, measure, mark, event.shiftKey);
  }

  overlay.addEventListener('click', onClick, true);
  overlay.addEventListener('pointerdown', (event) => {
    if (isLabel(event)) event.stopPropagation();
  }, true);
  doc.addEventListener('pointermove', onPointerMove, POINTER_MOVE);

  return () => {
    unsubscribe();
    stop();
    overlay.removeEventListener('click', onClick, true);
    doc.removeEventListener('pointermove', onPointerMove, POINTER_MOVE);
    overlay.remove();
    styleEl.remove();
  };
}

function applyMark(
  controller: InterfaceKitController,
  current: Measure,
  mark: DistanceMark,
  gapOnParent: boolean,
): void {
  const info = controller.getState().selectedElement;
  if (gapOnParent && !mark.nested) {
    const parent = parentToward(current.selected);
    if (parent && isFlexOrGrid(parent)) {
      const property = mark.axis === 'x' ? 'column-gap' : 'row-gap';
      controller.applyStyleGroup(
        [parent],
        property,
        `${mark.px}px`,
        spaceClass(property, mark.px),
        info ?? undefined,
      );
      return;
    }
  }

  const write = styleFromDistance(current.selectedRect, current.hoveredRect, mark);
  controller.applyStyleGroup(
    [current.selected],
    write.property,
    write.value,
    write.tailwindClass,
    info ?? undefined,
  );
}

function isLabel(event: Event): boolean {
  return event
    .composedPath()
    .some(
      (node) => node instanceof Element && node.hasAttribute('data-ik-label'),
    );
}

function toRect(box: DOMRect): AlignRect {
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function createOverlay(doc: Document): HTMLDivElement {
  const root = doc.createElement('div');
  root.setAttribute('data-interface-kit', '');
  root.setAttribute('data-ik-distance', '');

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

  marks.forEach((mark, index) => {
    const line = overlay.ownerDocument.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(mark.x1));
    line.setAttribute('y1', String(mark.y1));
    line.setAttribute('x2', String(mark.x2));
    line.setAttribute('y2', String(mark.y2));
    svg.append(line);

    const label = overlay.ownerDocument.createElement('button');
    label.type = 'button';
    label.setAttribute('data-ik-label', '');
    label.dataset.mark = String(index);
    label.textContent = `${mark.px}px`;
    label.title = 'Click to apply. Shift-click writes gap on a flex parent.';
    const cx = (mark.x1 + mark.x2) / 2;
    const cy = (mark.y1 + mark.y2) / 2;
    label.style.left = `${cx + (mark.axis === 'x' ? 0 : 12)}px`;
    label.style.top = `${cy + (mark.axis === 'x' ? -10 : 0)}px`;
    labels.append(label);
  });

  overlay.style.display = 'block';
}
