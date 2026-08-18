const COLOR_PROPERTIES = new Set([
  'background-color',
  'color',
  'border-color',
  'outline-color',
  'fill',
  'stroke',
]);

const CLASS_PREFIX: Record<string, string> = {
  'background-color': 'bg',
  color: 'text',
  'border-color': 'border',
  'outline-color': 'outline',
  'box-shadow': 'shadow',
};

/**
 * Map a computed color (hex / rgb) back onto a :root custom property when
 * the values match. The inspector shows F4F4F6; the prompt should keep
 * var(--paper).
 */
export function tokenForValue(
  doc: Document,
  property: string,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'none' || trimmed.startsWith('var(')) return null;

  const tokens = collectTokens(doc);
  if (isColorProperty(property)) {
    const color = normalizeColor(doc, trimmed);
    if (!color) return null;
    return tokens.colors.get(color) ?? null;
  }
  if (property === 'box-shadow') {
    return tokens.raw.get(collapse(trimmed)) ?? null;
  }
  return null;
}

export function tokenClass(property: string, token: string): string {
  const prefix = CLASS_PREFIX[property] ?? property;
  return `${prefix}-[var(${token})]`;
}

export function isColorProperty(property: string): boolean {
  return COLOR_PROPERTIES.has(property);
}

function collectTokens(doc: Document): {
  colors: Map<string, string>;
  raw: Map<string, string>;
} {
  const colors = new Map<string, string>();
  const raw = new Map<string, string>();
  const styles = doc.defaultView?.getComputedStyle(doc.documentElement);
  if (!styles) return { colors, raw };

  for (const name of styles) {
    if (!name.startsWith('--')) continue;
    const value = styles.getPropertyValue(name).trim();
    if (!value) continue;
    raw.set(collapse(value), name);
    const color = normalizeColor(doc, value);
    if (color && !colors.has(color)) colors.set(color, name);
  }
  return { colors, raw };
}

function normalizeColor(doc: Document, value: string): string | null {
  try {
    const canvas = doc.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#012345';
    ctx.fillStyle = value;
    if (ctx.fillStyle === '#012345') return null;
    return collapse(ctx.fillStyle);
  } catch {
    return null;
  }
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
