import type { AlignRect } from './snapGeometry.js';

export interface DistanceMark {
  axis: 'x' | 'y';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  px: number;
  nested: boolean;
}

/**
 * Distances between two boxes, Figma-style: outer gaps when they sit apart,
 * inset gaps when one contains the other. Same edges the guides already use.
 */
export function measureDistances(a: AlignRect, b: AlignRect): DistanceMark[] {
  const aRight = a.left + a.width;
  const aBottom = a.top + a.height;
  const bRight = b.left + b.width;
  const bBottom = b.top + b.height;

  if (contains(a, b)) return insets(a, b);
  if (contains(b, a)) return insets(b, a);

  const marks: DistanceMark[] = [];
  const overlapY = Math.min(aBottom, bBottom) > Math.max(a.top, b.top);
  const overlapX = Math.min(aRight, bRight) > Math.max(a.left, b.left);
  const y = overlapY
    ? mid(Math.max(a.top, b.top), Math.min(aBottom, bBottom))
    : mid(a.top + a.height / 2, b.top + b.height / 2);
  const x = overlapX
    ? mid(Math.max(a.left, b.left), Math.min(aRight, bRight))
    : mid(a.left + a.width / 2, b.left + b.width / 2);

  if (b.left >= aRight) {
    marks.push(hMark(aRight, b.left, y));
  } else if (a.left >= bRight) {
    marks.push(hMark(bRight, a.left, y));
  }

  if (b.top >= aBottom) {
    marks.push(vMark(x, aBottom, b.top));
  } else if (a.top >= bBottom) {
    marks.push(vMark(x, bBottom, a.top));
  }

  return marks.filter((mark) => mark.px > 0.5);
}

function contains(outer: AlignRect, inner: AlignRect): boolean {
  return (
    outer.left <= inner.left + 0.5 &&
    outer.top <= inner.top + 0.5 &&
    outer.left + outer.width >= inner.left + inner.width - 0.5 &&
    outer.top + outer.height >= inner.top + inner.height - 0.5
  );
}

function insets(outer: AlignRect, inner: AlignRect): DistanceMark[] {
  const outerRight = outer.left + outer.width;
  const outerBottom = outer.top + outer.height;
  const innerRight = inner.left + inner.width;
  const innerBottom = inner.top + inner.height;
  const cx = inner.left + inner.width / 2;
  const cy = inner.top + inner.height / 2;
  return [
    vMark(cx, outer.top, inner.top, true),
    vMark(cx, innerBottom, outerBottom, true),
    hMark(outer.left, inner.left, cy, true),
    hMark(innerRight, outerRight, cy, true),
  ].filter((mark) => mark.px > 0.5);
}

function hMark(x1: number, x2: number, y: number, nested = false): DistanceMark {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  return {
    axis: 'x',
    x1: left,
    y1: y,
    x2: right,
    y2: y,
    px: Math.round(right - left),
    nested,
  };
}

function vMark(x: number, y1: number, y2: number, nested = false): DistanceMark {
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  return {
    axis: 'y',
    x1: x,
    y1: top,
    x2: x,
    y2: bottom,
    px: Math.round(bottom - top),
    nested,
  };
}

function mid(a: number, b: number): number {
  return (a + b) / 2;
}
