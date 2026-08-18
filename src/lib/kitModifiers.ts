/**
 * Mac uses ⌘ to ignore snap (Figma). Alt is the Option key — people
 * don't reach for it, so distances no longer require a modifier.
 */

export function isApplePlatform(
  nav: { platform?: string; userAgent?: string } = globalThis.navigator ?? {},
): boolean {
  const platform = nav.platform ?? '';
  if (/Mac|iPhone|iPad|iPod/i.test(platform)) return true;
  return /Mac OS X|iPhone|iPad|iPod/i.test(nav.userAgent ?? '');
}

export function skipSnapFrom(
  event: {
    metaKey: boolean;
    ctrlKey: boolean;
  },
  apple: boolean = isApplePlatform(),
): boolean {
  return apple ? event.metaKey : event.ctrlKey;
}

export function isSkipSnapKey(event: KeyboardEvent): boolean {
  return isApplePlatform() ? event.key === 'Meta' : event.key === 'Control';
}

export function chromeHint(
  dragging: boolean,
  apple: boolean = isApplePlatform(),
): string {
  const free = apple ? '⌘ free' : 'Ctrl free';
  if (dragging) return `${free} · esc cancel`;
  return `${free} · esc parent · ↵ child`;
}
