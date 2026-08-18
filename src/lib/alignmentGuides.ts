import type {
  InterfaceKitController,
  InterfaceKitSnapshot,
  RectSnapshot,
} from 'interface-kit';

import { getActiveSnap } from './snapGeometry.js';

const STYLE_ID = 'interface-kit-guide-styles';
const SVG_NS = 'http://www.w3.org/2000/svg';

const GUIDE_IDS = [
  'v-left',
  'v-center',
  'v-right',
  'h-top',
  'h-center',
  'h-bottom',
] as const;

const GUIDE_CSS = `[data-ik-guides] {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 99997;
  pointer-events: none;
  display: none;
  overflow: hidden;
}
[data-ik-guides] line {
  stroke: #60a5fa;
  stroke-width: 1;
  stroke-opacity: 0.78;
}
[data-ik-guides] line[data-center] {
  stroke: #3b82f6;
  stroke-dasharray: 4 3;
  stroke-opacity: 0.92;
}
[data-ik-guides] line[data-snapped] {
  stroke: #2563eb;
  stroke-dasharray: none;
  stroke-opacity: 1;
  stroke-width: 1.5;
}
[data-ik-guides][data-snapping] line:not([data-snapped]) {
  stroke-opacity: 0;
}
`;

/**
 * Viewport-spanning alignment guides for the hovered (or selected)
 * InterfaceKit element. Three verticals (left, center, right) and three
 * horizontals (top, center, bottom) so edges and midlines can be checked
 * against the rest of the page.
 */
export function enableAlignmentGuides(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;

  let kitActive = false;
  let editingText = false;
  let hoveredRect: RectSnapshot | null = null;

  const overlay = createOverlay(doc);
  const styleEl = ensureGuideStyles(doc);
  doc.body.append(overlay);

  let frame = 0;

  const unsubscribe = controller.subscribe(onSnapshot);
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
    hoveredRect = snapshot.hoveredElement?.rect ?? null;
    syncLoop();
  }

  function canShow(): boolean {
    return kitActive && !editingText;
  }

  function syncLoop(): void {
    if (canShow() && (hoveredRect || controller.getSelectedElement())) {
      if (frame === 0) frame = win.requestAnimationFrame(tick);
      return;
    }
    stop();
  }

  function tick(): void {
    frame = 0;
    if (!canShow()) {
      hide();
      return;
    }

    const selected = controller.getSelectedElement();
    const rect = selected ? toRect(selected.getBoundingClientRect()) : hoveredRect;
    if (!rect || rect.width < 0.5 || rect.height < 0.5) {
      hide();
      return;
    }

    placeGuides(overlay, rect, win.innerWidth, win.innerHeight);
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

  // Hover rects are snapshotted on mousemove. Scroll without a move leaves
  // them stale, so drop hover-only guides until the pointer reports again.
  function onScroll(): void {
    if (!kitActive || controller.getSelectedElement()) return;
    if (!hoveredRect) return;
    hoveredRect = null;
    stop();
  }

  win.addEventListener('scroll', onScroll, true);

  return () => {
    unsubscribe();
    stop();
    win.removeEventListener('scroll', onScroll, true);
    overlay.remove();
    styleEl.remove();
  };
}

function toRect(box: DOMRect): RectSnapshot {
  return {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  };
}

function createOverlay(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('data-interface-kit', '');
  svg.setAttribute('data-ik-guides', '');
  svg.setAttribute('aria-hidden', 'true');
  for (const id of GUIDE_IDS) {
    const line = doc.createElementNS(SVG_NS, 'line');
    line.setAttribute('data-guide', id);
    if (id.includes('center')) line.setAttribute('data-center', '');
    svg.append(line);
  }
  return svg;
}

function ensureGuideStyles(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = GUIDE_CSS;
  doc.head.append(style);
  return style;
}

function snap(n: number): number {
  return Math.round(n) + 0.5;
}

function placeGuides(
  svg: SVGSVGElement,
  rect: RectSnapshot,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const left = snap(rect.left);
  const right = snap(rect.left + rect.width);
  const cx = snap(rect.left + rect.width / 2);
  const top = snap(rect.top);
  const bottom = snap(rect.top + rect.height);
  const cy = snap(rect.top + rect.height / 2);

  setLine(svg, 'v-left', left, 0, left, viewportHeight);
  setLine(svg, 'v-center', cx, 0, cx, viewportHeight);
  setLine(svg, 'v-right', right, 0, right, viewportHeight);
  setLine(svg, 'h-top', 0, top, viewportWidth, top);
  setLine(svg, 'h-center', 0, cy, viewportWidth, cy);
  setLine(svg, 'h-bottom', 0, bottom, viewportWidth, bottom);

  const active = getActiveSnap();
  markSnapped(svg, 'v-left', active.vertical.includes('left'));
  markSnapped(svg, 'v-center', active.vertical.includes('center'));
  markSnapped(svg, 'v-right', active.vertical.includes('right'));
  markSnapped(svg, 'h-top', active.horizontal.includes('top'));
  markSnapped(svg, 'h-center', active.horizontal.includes('center'));
  markSnapped(svg, 'h-bottom', active.horizontal.includes('bottom'));

  if (active.vertical.length > 0 || active.horizontal.length > 0) {
    svg.setAttribute('data-snapping', '');
  } else {
    svg.removeAttribute('data-snapping');
  }

  svg.style.display = 'block';
}

function markSnapped(svg: SVGSVGElement, id: string, snapped: boolean): void {
  const line = svg.querySelector(`[data-guide="${id}"]`);
  if (!(line instanceof SVGLineElement)) return;
  if (snapped) line.setAttribute('data-snapped', '');
  else line.removeAttribute('data-snapped');
}

function setLine(
  svg: SVGSVGElement,
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const line = svg.querySelector(`[data-guide="${id}"]`);
  if (!(line instanceof SVGLineElement)) return;
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
}
