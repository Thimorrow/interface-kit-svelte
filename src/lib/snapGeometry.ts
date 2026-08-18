/**
 * Light alignment snap for InterfaceKit drag and resize. Pure so the
 * threshold math can be pinned without mounting the overlay. Values are
 * CSS pixels.
 *
 * Catch order (lower score wins): nearest line, then same-edge over
 * flush, then boxes that overlap on the other axis. Edge-to-center is
 * ignored — centers only catch other centers, so a midline does not
 * steal an edge alignment.
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
export type SnapKind = 'edge' | 'center';

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

/**
 * Extra mouse travel, past the snap line, before the magnet lets go.
 * Combined with the catch threshold this is the well you push through
 * when you want to keep going. Origin-warped on release so the box
 * continues from the line instead of jumping to the cursor.
 */
export const SNAP_RESISTANCE_PX = 8;

/** Midlines are easier to leave than edges, so they do not trap a drag. */
export const SNAP_CENTER_RESISTANCE_PX = 3;

/** Perpendicular gap above this no longer changes the score. */
export const SNAP_NEAR_PX = 240;

export const NO_SNAP: SnapResult = {
  dx: 0,
  dy: 0,
  dWidth: 0,
  dHeight: 0,
  vertical: [],
  horizontal: [],
};

export interface AxisStick {
  /** Screen-space coordinate the axis is held to, or null when free. */
  lock: number | null;
  /** Persistent origin warp so breaking the magnet does not jump. */
  shift: number;
  /** Line we just left; do not recatch it until we leave the catch zone. */
  ignore: number | null;
  /** Edge wells hold longer than center wells. */
  kind: SnapKind | null;
}

export interface SnapStick {
  x: AxisStick;
  y: AxisStick;
}

export function createSnapStick(): SnapStick {
  return {
    x: { lock: null, shift: 0, ignore: null, kind: null },
    y: { lock: null, shift: 0, ignore: null, kind: null },
  };
}

export function resetSnapStick(stick: SnapStick): void {
  stick.x.lock = null;
  stick.x.shift = 0;
  stick.x.ignore = null;
  stick.x.kind = null;
  stick.y.lock = null;
  stick.y.shift = 0;
  stick.y.ignore = null;
  stick.y.kind = null;
}

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

  const dx = bestShift(moving, targets, 'x', threshold);
  const dy = bestShift(moving, targets, 'y', threshold);
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
 * `snapRect` plus a per-gesture magnet: once an axis catches, the box
 * stays on that line until the pointer pushes `threshold + resistance`
 * past it. Breaking warps `stick` so the next frames continue from the
 * line instead of leaping to the cursor.
 */
export function snapRectSticky(
  moving: AlignRect,
  targets: AlignRect[],
  stick: SnapStick,
  threshold: number = SNAP_THRESHOLD_PX,
  resistance: number = SNAP_RESISTANCE_PX,
): SnapResult {
  let left = releaseIfPushed(
    moving.left + stick.x.shift,
    stick.x,
    holdFor(stick.x, threshold, resistance),
  );
  let top = releaseIfPushed(
    moving.top + stick.y.shift,
    stick.y,
    holdFor(stick.y, threshold, resistance),
  );
  clearIgnore(left, stick.x, threshold);
  clearIgnore(top, stick.y, threshold);

  const trial: AlignRect = {
    left,
    top,
    width: moving.width,
    height: moving.height,
  };
  const caught = snapRect(trial, targets, threshold);

  if (stick.x.lock === null) {
    const snappedLeft = trial.left + caught.dx;
    if (caught.vertical.length > 0 && !sameLine(snappedLeft, stick.x.ignore)) {
      stick.x.lock = snappedLeft;
      stick.x.kind = kindFrom(caught.vertical);
      left = snappedLeft;
    }
  } else {
    left = stick.x.lock;
  }

  if (stick.y.lock === null) {
    const snappedTop = trial.top + caught.dy;
    if (caught.horizontal.length > 0 && !sameLine(snappedTop, stick.y.ignore)) {
      stick.y.lock = snappedTop;
      stick.y.kind = kindFrom(caught.horizontal);
      top = snappedTop;
    }
  } else {
    top = stick.y.lock;
  }

  const dx = left - moving.left;
  const dy = top - moving.top;
  if (
    dx === 0 &&
    dy === 0 &&
    stick.x.lock === null &&
    stick.y.lock === null
  ) {
    return NO_SNAP;
  }

  const snapped: AlignRect = {
    left,
    top,
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
      moving,
      targets,
      'x',
      threshold,
    );
    left = x.low;
    right = x.high;
  }

  if (moves.top || moves.bottom) {
    const y = snapAxis(
      { low: top, high: bottom, moveLow: moves.top, moveHigh: moves.bottom },
      moving,
      targets,
      'y',
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

/** Same magnet as `snapRectSticky`, applied to the edges the handle moves. */
export function snapResizeSticky(
  moving: AlignRect,
  handle: ResizeHandle,
  targets: AlignRect[],
  stick: SnapStick,
  threshold: number = SNAP_THRESHOLD_PX,
  resistance: number = SNAP_RESISTANCE_PX,
  minSize: number = MIN_SIZE_PX,
): SnapResult {
  const moves = handleMoves(handle);

  let left = moving.left + (moves.left ? stick.x.shift : 0);
  let top = moving.top + (moves.top ? stick.y.shift : 0);
  let right =
    moving.left + moving.width + (moves.right ? stick.x.shift : 0);
  let bottom =
    moving.top + moving.height + (moves.bottom ? stick.y.shift : 0);

  if (moves.left || moves.right) {
    const next = releaseIfPushed(
      moves.left ? left : right,
      stick.x,
      holdFor(stick.x, threshold, resistance),
    );
    if (moves.left) left = next;
    else right = next;
    clearIgnore(next, stick.x, threshold);
  }
  if (moves.top || moves.bottom) {
    const next = releaseIfPushed(
      moves.top ? top : bottom,
      stick.y,
      holdFor(stick.y, threshold, resistance),
    );
    if (moves.top) top = next;
    else bottom = next;
    clearIgnore(next, stick.y, threshold);
  }

  const trial: AlignRect = {
    left,
    top,
    width: Math.max(right - left, minSize),
    height: Math.max(bottom - top, minSize),
  };
  const caught = snapResize(trial, handle, targets, threshold, minSize);

  if (moves.left || moves.right) {
    const snappedLeft = trial.left + caught.dx;
    const snappedRight = snappedLeft + trial.width + caught.dWidth;
    const snappedEdge = moves.left ? snappedLeft : snappedRight;
    if (stick.x.lock === null) {
      if (
        caught.vertical.length > 0 &&
        !sameLine(snappedEdge, stick.x.ignore)
      ) {
        stick.x.lock = snappedEdge;
        stick.x.kind = kindFrom(caught.vertical);
        if (moves.left) left = snappedEdge;
        else right = snappedEdge;
      }
    } else if (moves.left) {
      left = stick.x.lock;
    } else {
      right = stick.x.lock;
    }
  }

  if (moves.top || moves.bottom) {
    const snappedTop = trial.top + caught.dy;
    const snappedBottom = snappedTop + trial.height + caught.dHeight;
    const snappedEdge = moves.top ? snappedTop : snappedBottom;
    if (stick.y.lock === null) {
      if (
        caught.horizontal.length > 0 &&
        !sameLine(snappedEdge, stick.y.ignore)
      ) {
        stick.y.lock = snappedEdge;
        stick.y.kind = kindFrom(caught.horizontal);
        if (moves.top) top = snappedEdge;
        else bottom = snappedEdge;
      }
    } else if (moves.top) {
      top = stick.y.lock;
    } else {
      bottom = stick.y.lock;
    }
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
  if (
    dx === 0 &&
    dy === 0 &&
    dWidth === 0 &&
    dHeight === 0 &&
    stick.x.lock === null &&
    stick.y.lock === null
  ) {
    return NO_SNAP;
  }

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

function holdFor(
  axis: AxisStick,
  threshold: number,
  resistance: number,
): number {
  const extra =
    axis.kind === 'center' ? SNAP_CENTER_RESISTANCE_PX : resistance;
  return threshold + extra;
}

function kindFrom(edges: readonly string[]): SnapKind {
  const onlyCenter = edges.length > 0 && edges.every((edge) => edge === 'center');
  return onlyCenter ? 'center' : 'edge';
}

function releaseIfPushed(
  pos: number,
  axis: AxisStick,
  hold: number,
): number {
  if (axis.lock === null) return pos;
  const dist = pos - axis.lock;
  if (Math.abs(dist) <= hold) return axis.lock;
  const dir = dist > 0 ? 1 : -1;
  axis.shift -= dir * hold;
  axis.ignore = axis.lock;
  axis.lock = null;
  axis.kind = null;
  return pos - dir * hold;
}

function clearIgnore(pos: number, axis: AxisStick, threshold: number): void {
  if (axis.ignore !== null && Math.abs(pos - axis.ignore) > threshold) {
    axis.ignore = null;
  }
}

function sameLine(value: number, ignore: number | null): boolean {
  return ignore !== null && Math.abs(value - ignore) < 0.51;
}

type PairKind = 'align' | 'flush' | 'mixed';

function pairKind(a: string, b: string): PairKind {
  if (a === b) return 'align';
  if (a !== 'center' && b !== 'center') return 'flush';
  return 'mixed';
}

function pairCost(kind: PairKind): number {
  if (kind === 'align') return 0;
  if (kind === 'flush') return 0.35;
  return Number.POSITIVE_INFINITY;
}

function gapX(a: AlignRect, b: AlignRect): number {
  const a2 = a.left + a.width;
  const b2 = b.left + b.width;
  if (a2 < b.left) return b.left - a2;
  if (b2 < a.left) return a.left - b2;
  return 0;
}

function gapY(a: AlignRect, b: AlignRect): number {
  const a2 = a.top + a.height;
  const b2 = b.top + b.height;
  if (a2 < b.top) return b.top - a2;
  if (b2 < a.top) return a.top - b2;
  return 0;
}

function scoreOf(dist: number, kind: PairKind, gap: number): number {
  const cost = pairCost(kind);
  if (!Number.isFinite(cost)) return Number.POSITIVE_INFINITY;
  return dist + cost + Math.min(gap, SNAP_NEAR_PX) / 80;
}

function axisEdges(rect: AlignRect, axis: 'x' | 'y'): Record<string, number> {
  return axis === 'x' ? xEdges(rect) : yEdges(rect);
}

function bestShift(
  moving: AlignRect,
  targets: AlignRect[],
  axis: 'x' | 'y',
  threshold: number,
): number {
  const movingEdges = axisEdges(moving, axis);
  const names = axis === 'x' ? X_EDGES : Y_EDGES;
  let best = Number.POSITIVE_INFINITY;
  let shift = 0;

  for (const target of targets) {
    const targetEdges = axisEdges(target, axis);
    const gap = axis === 'x' ? gapY(moving, target) : gapX(moving, target);
    for (const me of names) {
      for (const te of names) {
        const kind = pairKind(me, te);
        if (kind === 'mixed') continue;
        const delta = targetEdges[te] - movingEdges[me];
        const dist = Math.abs(delta);
        if (dist >= threshold) continue;
        const score = scoreOf(dist, kind, gap);
        if (score < best) {
          best = score;
          shift = delta;
        }
      }
    }
  }

  return Number.isFinite(best) ? shift : 0;
}

function snapAxis(
  box: { low: number; high: number; moveLow: boolean; moveHigh: boolean },
  moving: AlignRect,
  targets: AlignRect[],
  axis: 'x' | 'y',
  threshold: number,
): { low: number; high: number } {
  let best = Number.POSITIVE_INFINITY;
  let nextLow = box.low;
  let nextHigh = box.high;
  const center = (box.low + box.high) / 2;
  const names = axis === 'x' ? X_EDGES : Y_EDGES;
  const highName = axis === 'x' ? 'right' : 'bottom';
  const lowName = axis === 'x' ? 'left' : 'top';

  const consider = (
    dist: number,
    kind: PairKind,
    gap: number,
    apply: () => void,
  ): void => {
    if (dist >= threshold) return;
    const score = scoreOf(dist, kind, gap);
    if (score < best) {
      best = score;
      apply();
    }
  };

  for (const target of targets) {
    const targetEdges = axisEdges(target, axis);
    const gap = axis === 'x' ? gapY(moving, target) : gapX(moving, target);
    for (const te of names) {
      const line = targetEdges[te];
      if (box.moveHigh) {
        consider(Math.abs(box.high - line), pairKind(highName, te), gap, () => {
          nextLow = box.low;
          nextHigh = line;
        });
      }
      if (box.moveLow) {
        consider(Math.abs(box.low - line), pairKind(lowName, te), gap, () => {
          nextLow = line;
          nextHigh = box.high;
        });
      }
      consider(Math.abs(center - line), pairKind('center', te), gap, () => {
        if (box.moveHigh && !box.moveLow) {
          nextLow = box.low;
          nextHigh = 2 * line - box.low;
        } else if (box.moveLow && !box.moveHigh) {
          nextHigh = box.high;
          nextLow = 2 * line - box.high;
        }
      });
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
 * Visible, meaningful boxes to snap against: the parent, siblings, and
 * other page furniture in the viewport. Full-page wrappers stay out so
 * a drag does not glue itself to the canvas midline.
 */
export function collectSnapTargets(
  doc: Document,
  moving: HTMLElement,
  viewport: { width: number; height: number },
): AlignRect[] {
  const seen = new Set<Element>([moving]);
  const out: AlignRect[] = [];

  const add = (node: Element, opts?: { allowLarge?: boolean }): void => {
    if (!(node instanceof HTMLElement)) return;
    if (seen.has(node)) return;
    if (node.hasAttribute('data-interface-kit')) return;
    if (moving.contains(node) || node.contains(moving)) return;
    if (node === doc.body || node === doc.documentElement) return;

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
    if (
      !opts?.allowLarge &&
      box.width > viewport.width * 0.9 &&
      box.height > viewport.height * 0.45
    ) {
      return;
    }

    seen.add(node);
    const left = Math.round(box.left);
    const top = Math.round(box.top);
    const right = Math.round(box.left + box.width);
    const bottom = Math.round(box.top + box.height);
    out.push({
      left,
      top,
      width: right - left,
      height: bottom - top,
    });
  };

  doc.querySelectorAll(CANDIDATE_SELECTOR).forEach((node) => add(node));

  const parent = moving.parentElement;
  if (parent) {
    add(parent, { allowLarge: true });
    for (const child of parent.children) add(child, { allowLarge: true });
  }

  return out;
}
