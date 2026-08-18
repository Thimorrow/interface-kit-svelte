import type { DistanceMark } from './distanceGeometry.js';
import type { AlignRect } from './snapGeometry.js';

export interface DistanceWrite {
  property: string;
  value: string;
  tailwindClass: string;
}

/**
 * Turn a distance mark into a style write on the selected element.
 * Nested + selected is the outer box → padding. Otherwise margin
 * toward the hovered box. Gap is a separate parent write.
 */
export function styleFromDistance(
  selected: AlignRect,
  hovered: AlignRect,
  mark: DistanceMark,
): DistanceWrite {
  const value = `${mark.px}px`;
  const property = propertyFor(selected, hovered, mark);
  return { property, value, tailwindClass: spaceClass(property, mark.px) };
}

export function spaceClass(property: string, px: number): string {
  const prefix: Record<string, string> = {
    'margin-left': 'ml',
    'margin-right': 'mr',
    'margin-top': 'mt',
    'margin-bottom': 'mb',
    'padding-left': 'pl',
    'padding-right': 'pr',
    'padding-top': 'pt',
    'padding-bottom': 'pb',
    gap: 'gap',
    'row-gap': 'gap-y',
    'column-gap': 'gap-x',
  };
  const token = prefix[property] ?? property;
  return `${token}-[${px}px]`;
}

function propertyFor(
  selected: AlignRect,
  hovered: AlignRect,
  mark: DistanceMark,
): string {
  const selectedOuter = contains(selected, hovered);
  const prefix = selectedOuter ? 'padding' : 'margin';

  if (mark.axis === 'x') {
    const mid = (mark.x1 + mark.x2) / 2;
    const center = selected.left + selected.width / 2;
    return mid < center ? `${prefix}-left` : `${prefix}-right`;
  }

  const mid = (mark.y1 + mark.y2) / 2;
  const center = selected.top + selected.height / 2;
  return mid < center ? `${prefix}-top` : `${prefix}-bottom`;
}

function contains(outer: AlignRect, inner: AlignRect): boolean {
  return (
    outer.left <= inner.left + 0.5 &&
    outer.top <= inner.top + 0.5 &&
    outer.left + outer.width >= inner.left + inner.width - 0.5 &&
    outer.top + outer.height >= inner.top + inner.height - 0.5
  );
}
