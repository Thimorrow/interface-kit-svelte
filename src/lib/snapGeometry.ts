/**
 * Light alignment snap for InterfaceKit drag and resize. Pure so the
 * threshold math can be pinned without mounting the overlay. Values are
 * CSS pixels.
 */

import { handleMoves, MIN_SIZE_PX, type ResizeHandle } from './transformGeometry.js';

export interface AlignRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type SnapEdgeX = 'left' | 'center' | 'right';
export type SnapEdgeY = 'top' | 'center' | 'bottom';

export interface SnapResult {
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
  vertical: SnapEdgeX[];
  horizontal: SnapEdgeY[];
}

/** How close an edge must be before it catches. Small on purpose: a hint, not a magnet. */
export const SNAP_THRESHOLD_PX = 6;

export const NO_SNAP: SnapResult = {
  dx: 0,
  dy: 0,
  dWidth: 0,
  dHeight: 0,
  vertical: [],
  horizontal: [],
};

const X_EDGES: SnapEdgeX[] = ['left', 'center', 'right'];
const Y_EDGES: SnapEdgeY[] = ['top', 'center', 'bottom'];

let activeSnap: SnapResult = NO_SNAP;

export function getActiveSnap(): SnapResult {
  return activeSnap;
}

export function setActiveSnap(next: SnapResult): void {
  activeSnap = next;
}

export function xEdges(rect: AlignRect): Record<SnapEdgeX, number> {
  return {
    left: rect.left,
    center: rect.left + rect.width / 2,
    right: rect.left + rect.width,
  };
}

export function yEdges(rect: AlignRect): Record<SnapEdgeY, number> {
  return {
    top: rect.top,
    center: rect.top + rect.height / 2,
    bottom: rect.top + rect.height,
  };
}

/**
 * Shift `moving` so its edges/centers catch the nearest target within
 * `threshold`. X and Y are independent. Returns 0,0 when nothing is close.
 */
export function snapRect(
  moving: AlignRect,
  targets: AlignRect[],
  threshold: number = SNAP_THRESHOLD_PX,
): SnapResult {
  if (targets.length === 0) return NO_SNAP;

  const mx = xEdges(moving);
  const my = yEdges(moving);

  let bestX = threshold;
  let dx = 0;
  let bestY = threshold;
  let dy = 0;

  for (const target of targets) {
    const tx = xEdges(target);
    const ty = yEdges(target);

    for (const me of X_EDGES) {
      for (const te of X_EDGES) {
        const delta = tx[te] - mx[me];
        const dist = Math.abs(delta);
        if (dist < bestX) {
          bestX = dist;
          dx = delta;
        }
      }
    }

    for (const me of Y_EDGES) {
      for (const te of Y_EDGES) {
        const delta = ty[te] - my[me];
        const dist = Math.abs(delta);
        if (dist < bestY) {
          bestY = dist;
          dy = delta;
        }
      }
    }
  }

  if (bestX >= threshold) dx = 0;
  if (bestY >= threshold) dy = 0;
  if (dx === 0 && dy === 0) return NO_SNAP;

  const snapped: AlignRect = {
    left: moving.left + dx,
    top: moving.top + dy,
    width: moving.width,
    height: moving.height,
  };

  return {
    dx,
    dy,
    dWidth: 0,
    dHeight: 0,
    vertical: matchingX(snapped, targets),
    horizontal: matchingY(snapped, targets),
  };
}

/**
 * Snap the edges a resize handle is dragging. The opposite edge stays put
 * (no 8px grid, no parent padding). Centers of the moving box can catch too.
 */
export function snapResize(
  moving: AlignRect,
  handle: ResizeHandle,
  targets: AlignRect[],
  threshold: number = SNAP_THRESHOLD_PX,
  minSize: number = MIN_SIZE_PX,
): SnapResult {
  if (targets.length === 0) return NO_SNAP;

  const moves = handleMoves(handle);
  let left = moving.left;
  let top = moving.top;
  let right = moving.left + moving.width;
  let bottom = moving.top + moving.height;

  if (moves.left || moves.right) {
    const x = snapAxis(
      { low: left, high: right, moveLow: moves.left, moveHigh: moves.right },
      targets.map((target) => xEdges(target)),
      threshold,
    );
    left = x.low;
    right = x.high;
  }

  if (moves.top || moves.bottom) {
    const y = snapAxis(
      { low: top, high: bottom, moveLow: moves.top, moveHigh: moves.bottom },
      targets.map((target) => yEdges(target)),
      threshold,
    );
    top = y.low;
    bottom = y.high;
  }

  if (right - left < minSize) {
    if (moves.right && !moves.left) right = left + minSize;
    else if (moves.left && !moves.right) left = right - minSize;
  }
  if (bottom - top < minSize) {
    if (moves.bottom && !moves.top) bottom = top + minSize;
    else if (moves.top && !moves.bottom) top = bottom - minSize;
  }

  const dx = left - moving.left;
  const dy = top - moving.top;
  const dWidth = right - left - moving.width;
  const dHeight = bottom - top - moving.height;
  if (dx === 0 && dy === 0 && dWidth === 0 && dHeight === 0) return NO_SNAP;

  const snapped: AlignRect = {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };

  return {
    dx,
    dy,
    dWidth,
    dHeight,
    vertical: matchingX(snapped, targets),
    horizontal: matchingY(snapped, targets),
  };
}

function snapAxis(
  box: { low: number; high: number; moveLow: boolean; moveHigh: boolean },
  targets: Record<string, number>[],
  threshold: number,
): { low: number; high: number } {
  let best = threshold;
  let nextLow = box.low;
  let nextHigh = box.high;
  const center = (box.low + box.high) / 2;

  for (const edges of targets) {
    for (const target of Object.values(edges)) {
      if (box.moveHigh) {
        const dist = Math.abs(box.high - target);
        if (dist < best) {
          best = dist;
          nextLow = box.low;
          nextHigh = target;
        }
      }
      if (box.moveLow) {
        const dist = Math.abs(box.low - target);
        if (dist < best) {
          best = dist;
          nextLow = target;
          nextHigh = box.high;
        }
      }
      const distCenter = Math.abs(center - target);
      if (distCenter < best) {
        best = distCenter;
        if (box.moveHigh && !box.moveLow) {
          nextLow = box.low;
          nextHigh = 2 * target - box.low;
        } else if (box.moveLow && !box.moveHigh) {
          nextHigh = box.high;
          nextLow = 2 * target - box.high;
        }
      }
    }
  }

  return { low: nextLow, high: nextHigh };
}

function matchingX(moving: AlignRect, targets: AlignRect[]): SnapEdgeX[] {
  const mx = xEdges(moving);
  const hit: SnapEdgeX[] = [];
  for (const edge of X_EDGES) {
    if (targets.some((target) => alignsWith(mx[edge], xEdges(target)))) {
      hit.push(edge);
    }
  }
  return hit;
}

function matchingY(moving: AlignRect, targets: AlignRect[]): SnapEdgeY[] {
  const my = yEdges(moving);
  const hit: SnapEdgeY[] = [];
  for (const edge of Y_EDGES) {
    if (targets.some((target) => alignsWith(my[edge], yEdges(target)))) {
      hit.push(edge);
    }
  }
  return hit;
}

function alignsWith(value: number, edges: Record<string, number>): boolean {
  for (const edge of Object.values(edges)) {
    if (Math.abs(edge - value) < 0.51) return true;
  }
  return false;
}

const CANDIDATE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'label',
  '[role="button"]',
  'article',
  'li',
].join(',');

/**
 * Visible, meaningful boxes to snap against: buttons and other page
 * furniture in the viewport, plus siblings of the moving element.
 */
export function collectSnapTargets(
  doc: Document,
  moving: HTMLElement,
  viewport: { width: number; height: number },
): AlignRect[] {
  const seen = new Set<Element>([moving]);
  const out: AlignRect[] = [];

  const add = (node: Element): void => {
    if (!(node instanceof HTMLElement)) return;
    if (seen.has(node)) return;
    if (node.hasAttribute('data-interface-kit')) return;
    if (moving.contains(node) || node.contains(moving)) return;

    const box = node.getBoundingClientRect();
    if (box.width < 8 || box.height < 8) return;
    if (
      box.bottom < 0 ||
      box.right < 0 ||
      box.top > viewport.height ||
      box.left > viewport.width
    ) {
      return;
    }
    if (box.width > viewport.width * 0.9 && box.height > viewport.height * 0.45) {
      return;
    }

    seen.add(node);
    out.push({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    });
  };

  doc.querySelectorAll(CANDIDATE_SELECTOR).forEach(add);

  const parent = moving.parentElement;
  if (parent) {
    for (const child of parent.children) add(child);
  }

  return out;
}
