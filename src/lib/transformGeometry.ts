/**
 * Geometry helpers for InterfaceKit move/resize. Pure so the handle math can
 * be pinned without mounting the overlay. Values are CSS pixels.
 */

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface Translate {
  x: number;
  y: number;
}

export interface TransformBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_SIZE_PX = 16;

const NORTH = new Set<ResizeHandle>(['n', 'ne', 'nw']);
const SOUTH = new Set<ResizeHandle>(['s', 'se', 'sw']);
const EAST = new Set<ResizeHandle>(['e', 'ne', 'se']);
const WEST = new Set<ResizeHandle>(['w', 'nw', 'sw']);
const CORNER = new Set<ResizeHandle>(['ne', 'nw', 'se', 'sw']);

export function parseTranslate(raw: string | null | undefined): Translate {
  if (!raw || raw === 'none') return { x: 0, y: 0 };
  const parts = raw.trim().split(/\s+/).map(parseFloat);
  return { x: parts[0] || 0, y: parts[1] || 0 };
}

export function translateClass(x: number, y: number): string {
  return `translate-x-[${x}px] translate-y-[${y}px]`;
}

export function sizeClass(property: 'width' | 'height', px: number): string {
  return property === 'width' ? `w-[${px}px]` : `h-[${px}px]`;
}

/**
 * Resize a box from a handle. The opposite edge stays put: west/north
 * handles also shift `x`/`y` (the CSS `translate`) so the element does not
 * grow away from the dragged corner. `lockAspect` (Shift) only applies to
 * corners.
 */
export function resizeFrom(
  handle: ResizeHandle,
  start: TransformBox,
  dx: number,
  dy: number,
  options: { minSize?: number; lockAspect?: boolean } = {},
): TransformBox {
  const minSize = options.minSize ?? MIN_SIZE_PX;
  const right = start.x + start.width;
  const bottom = start.y + start.height;

  let width = start.width;
  let height = start.height;
  let x = start.x;
  let y = start.y;

  if (EAST.has(handle)) width = start.width + dx;
  if (WEST.has(handle)) width = start.width - dx;
  if (SOUTH.has(handle)) height = start.height + dy;
  if (NORTH.has(handle)) height = start.height - dy;

  if (
    options.lockAspect &&
    CORNER.has(handle) &&
    start.width > 0 &&
    start.height > 0
  ) {
    const ratio = start.width / start.height;
    const dw = Math.abs(width - start.width) / start.width;
    const dh = Math.abs(height - start.height) / start.height;
    if (dw >= dh) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  width = Math.max(minSize, width);
  height = Math.max(minSize, height);

  if (WEST.has(handle)) x = right - width;
  if (NORTH.has(handle)) y = bottom - height;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}
