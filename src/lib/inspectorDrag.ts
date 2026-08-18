import type { InterfaceKitController, InterfaceKitSnapshot } from 'interface-kit';

import {
  createAxis,
  jumpAxis,
  prefersReducedMotion,
  tickAxes,
  type SpringAxis,
} from './dragSpring.js';

const STYLE_ID = 'interface-kit-inspector-drag';
const HANDLE_ATTR = 'data-ik-inspector-handle';
const KIT_ATTR = 'data-interface-kit';
const DRAG_THRESHOLD = 5;
const MARGIN = 8;
const TOOLBAR_MIN_WIDTH = 200;
const TOOLBAR_HEIGHT_MIN = 40;
const TOOLBAR_HEIGHT_MAX = 48;

const HANDLE_CSS = `[${HANDLE_ATTR}] {
  cursor: grab;
  touch-action: none;
}
[${HANDLE_ATTR}] button,
[${HANDLE_ATTR}] a {
  cursor: pointer;
}
`;

/**
 * The package only drags the collapsed paintbrush (`if (isExpanded) return`).
 * Once the kit is open, this makes the Copy Edits bar a handle and keeps the
 * inspector (and settings) attached to it via CSS `translate`, which Motion
 * does not own.
 */
export function enableInspectorDrag(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;

  let kitActive = false;
  let offset = { x: 0, y: 0 };
  let shadow: ShadowRoot | null = null;
  let shadowObserver: MutationObserver | null = null;
  let hostObserver: MutationObserver | null = null;

  type Gesture = {
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    started: boolean;
    handle: HTMLElement;
    pointerId: number;
  };

  let gesture: Gesture | null = null;
  let prevCursor = '';
  let prevUserSelect = '';
  let bodyStyled = false;
  let releasing = false;
  let springFrame = 0;
  let springLast = 0;
  let motion: { x: SpringAxis; y: SpringAxis } | null = null;

  const unsubscribe = controller.subscribe(onSnapshot);
  onSnapshot(controller.getState());

  const existing = findKitShadow(doc);
  if (existing) {
    watchShadow(existing);
  } else {
    hostObserver = new MutationObserver(() => {
      const next = findKitShadow(doc);
      if (!next) return;
      hostObserver?.disconnect();
      hostObserver = null;
      watchShadow(next);
    });
    hostObserver.observe(doc.body, { childList: true, subtree: true });
  }

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    const wasActive = kitActive;
    kitActive = snapshot.isActive;
    if (!kitActive) {
      if (wasActive || offset.x !== 0 || offset.y !== 0) {
        stopSpringLoop();
        motion = null;
        releasing = false;
        gesture = null;
        offset = { x: 0, y: 0 };
        applyOffset();
      }
      return;
    }
    syncHandle();
    applyOffset();
  }

  function watchShadow(root: ShadowRoot): void {
    shadow = root;
    ensureShadowStyles(root);
    syncHandle();
    applyOffset();
    shadowObserver?.disconnect();
    shadowObserver = new MutationObserver(() => {
      syncHandle();
      applyOffset();
    });
    shadowObserver.observe(root, { childList: true, subtree: true });
  }

  function syncHandle(): void {
    if (!shadow) return;
    const handle = findToolbar(shadow);
    for (const el of shadow.querySelectorAll<HTMLElement>(`[${HANDLE_ATTR}]`)) {
      if (el !== handle) el.removeAttribute(HANDLE_ATTR);
    }
    if (kitActive && handle) handle.setAttribute(HANDLE_ATTR, '');
  }

  function applyOffset(round = true): void {
    if (!shadow) return;
    const x = round ? Math.round(offset.x) : Number(offset.x.toFixed(2));
    const y = round ? Math.round(offset.y) : Number(offset.y.toFixed(2));
    const value = x === 0 && y === 0 ? '' : `${x}px ${y}px`;
    for (const el of movablePanels(shadow)) {
      el.style.translate = value;
    }
  }

  function beginBodyStyle(): void {
    if (bodyStyled) return;
    prevCursor = doc.body.style.cursor;
    prevUserSelect = doc.body.style.userSelect;
    doc.body.style.cursor = 'grabbing';
    doc.body.style.userSelect = 'none';
    bodyStyled = true;
  }

  function restoreBodyStyles(): void {
    if (!bodyStyled) return;
    doc.body.style.cursor = prevCursor;
    doc.body.style.userSelect = prevUserSelect;
    bodyStyled = false;
  }

  function stopSpringLoop(): void {
    if (springFrame !== 0) {
      win.cancelAnimationFrame(springFrame);
      springFrame = 0;
    }
    springLast = 0;
  }

  function beginMotion(x: number, y: number): void {
    stopSpringLoop();
    if (prefersReducedMotion(win)) {
      motion = null;
      return;
    }
    motion = { x: createAxis(x), y: createAxis(y) };
    kickSpring();
  }

  function kickSpring(): void {
    if (springFrame !== 0 || !motion) return;
    springLast = 0;
    springFrame = win.requestAnimationFrame(onSpringFrame);
  }

  function applyMotion(round: boolean): void {
    if (!motion) return;
    offset = { x: motion.x.current, y: motion.y.current };
    applyOffset(round);
  }

  function onSpringFrame(now: number): void {
    springFrame = 0;
    if (!motion) return;

    const dt =
      springLast === 0 ? 1 / 60 : Math.min(0.064, (now - springLast) / 1000);
    springLast = now;

    const reduced = prefersReducedMotion(win);
    if (reduced) {
      jumpAxis(motion.x, motion.x.target);
      jumpAxis(motion.y, motion.y.target);
    }

    const settled = reduced || tickAxes([motion.x, motion.y], dt);
    applyMotion(settled && releasing);

    if (!settled) {
      springFrame = win.requestAnimationFrame(onSpringFrame);
      return;
    }

    if (releasing) {
      motion = null;
      gesture = null;
      releasing = false;
      springLast = 0;
    }
  }

  function settleIfReleasing(): void {
    if (!releasing) return;
    applyMotion(true);
    stopSpringLoop();
    motion = null;
    gesture = null;
    releasing = false;
  }

  function bindDrag(): void {
    doc.addEventListener('pointermove', onPointerMove, true);
    doc.addEventListener('pointerup', onPointerUp, true);
    doc.addEventListener('pointercancel', onPointerUp, true);
  }

  function unbindDrag(): void {
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('pointerup', onPointerUp, true);
    doc.removeEventListener('pointercancel', onPointerUp, true);
  }

  function onPointerDown(event: PointerEvent): void {
    settleIfReleasing();
    if (!kitActive || event.button !== 0) return;
    if (gesture) return;

    const handle = toolbarFromEvent(event);
    if (!handle) return;

    gesture = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
      started: false,
      handle,
      pointerId: event.pointerId,
    };
    bindDrag();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.started) {
      if (Math.abs(dx) + Math.abs(dy) <= DRAG_THRESHOLD) return;
      gesture.started = true;
      beginBodyStyle();
      beginMotion(offset.x, offset.y);
      try {
        gesture.handle.setPointerCapture(event.pointerId);
      } catch {
        // Capture is best-effort; document listeners still drive the drag.
      }
    }

    event.preventDefault();
    const next = clampToViewport(
      gesture.baseX + dx,
      gesture.baseY + dy,
      gesture.handle,
      { x: motion?.x.current ?? offset.x, y: motion?.y.current ?? offset.y },
      win,
    );
    if (!motion) {
      offset = next;
      applyOffset();
      return;
    }
    motion.x.target = next.x;
    motion.y.target = next.y;
    kickSpring();
  }

  function onPointerUp(event: PointerEvent): void {
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const started = gesture.started;
    const handle = gesture.handle;
    if (started) {
      try {
        if (handle.hasPointerCapture(event.pointerId)) {
          handle.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Already released.
      }
      swallowNextClick(win);
    }

    unbindDrag();
    restoreBodyStyles();

    if (!started) {
      gesture = null;
      return;
    }

    if (!motion) {
      offset = {
        x: Math.round(offset.x),
        y: Math.round(offset.y),
      };
      applyOffset();
      gesture = null;
      return;
    }

    releasing = true;
    kickSpring();
  }

  function cancelGesture(): void {
    if (!gesture) return;
    offset = { x: gesture.baseX, y: gesture.baseY };
    applyOffset();
    stopSpringLoop();
    motion = null;
    releasing = false;
    unbindDrag();
    restoreBodyStyles();
    gesture = null;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !gesture) return;
    event.preventDefault();
    event.stopPropagation();
    cancelGesture();
  }

  function onResize(): void {
    if (!kitActive || !shadow) return;
    const handle = findToolbar(shadow);
    if (!handle) return;
    const current = {
      x: motion?.x.current ?? offset.x,
      y: motion?.y.current ?? offset.y,
    };
    const desired = {
      x: motion?.x.target ?? offset.x,
      y: motion?.y.target ?? offset.y,
    };
    const next = clampToViewport(desired.x, desired.y, handle, current, win);
    if (motion) {
      jumpAxis(motion.x, next.x);
      jumpAxis(motion.y, next.y);
    }
    offset = next;
    applyOffset();
  }

  win.addEventListener('pointerdown', onPointerDown, true);
  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('resize', onResize);

  return () => {
    unsubscribe();
    unbindDrag();
    stopSpringLoop();
    restoreBodyStyles();
    win.removeEventListener('pointerdown', onPointerDown, true);
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('resize', onResize);
    shadowObserver?.disconnect();
    hostObserver?.disconnect();
    if (shadow) {
      offset = { x: 0, y: 0 };
      applyOffset();
      for (const el of shadow.querySelectorAll(`[${HANDLE_ATTR}]`)) {
        el.removeAttribute(HANDLE_ATTR);
      }
      shadow.getElementById(STYLE_ID)?.remove();
    }
  };
}

function findKitShadow(doc: Document): ShadowRoot | null {
  for (const el of doc.querySelectorAll(`[${KIT_ATTR}]`)) {
    if (el.shadowRoot) return el.shadowRoot;
  }
  return null;
}

function isToolbar(el: HTMLElement): boolean {
  if (!el.hasAttribute(KIT_ATTR)) return false;
  const box = el.getBoundingClientRect();
  return (
    box.width >= TOOLBAR_MIN_WIDTH &&
    box.height >= TOOLBAR_HEIGHT_MIN &&
    box.height <= TOOLBAR_HEIGHT_MAX
  );
}

function findToolbar(root: ShadowRoot): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(`[${KIT_ATTR}]`)) {
    if (isToolbar(el)) return el;
  }
  return null;
}

function toolbarFromEvent(event: Event): HTMLElement | null {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLElement && isToolbar(node)) return node;
  }
  return null;
}

function movablePanels(root: ShadowRoot): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(`[${KIT_ATTR}]`)) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    if (cs.pointerEvents === 'none') continue;
    if (el.getBoundingClientRect().width < TOOLBAR_MIN_WIDTH) continue;
    out.push(el);
  }
  return out;
}

function clampToViewport(
  x: number,
  y: number,
  handle: HTMLElement,
  current: { x: number; y: number },
  win: Window,
): { x: number; y: number } {
  const box = handle.getBoundingClientRect();
  const layoutLeft = box.left - current.x;
  const layoutTop = box.top - current.y;
  const minX = MARGIN - layoutLeft;
  const maxX = win.innerWidth - MARGIN - box.width - layoutLeft;
  const minY = MARGIN - layoutTop;
  const maxY = win.innerHeight - MARGIN - box.height - layoutTop;
  return {
    x: Math.round(clamp(x, Math.min(minX, maxX), Math.max(minX, maxX))),
    y: Math.round(clamp(y, Math.min(minY, maxY), Math.max(minY, maxY))),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function swallowNextClick(win: Window): void {
  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    win.removeEventListener('click', onClick, true);
  };
  win.addEventListener('click', onClick, true);
  setTimeout(() => win.removeEventListener('click', onClick, true), 0);
}

function ensureShadowStyles(shadow: ShadowRoot): void {
  if (shadow.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HANDLE_CSS;
  shadow.append(style);
}
