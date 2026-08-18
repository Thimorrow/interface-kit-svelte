import type {
  InterfaceKitController,
  InterfaceKitSnapshot,
} from 'interface-kit';

import {
  collectSnapTargets,
  NO_SNAP,
  setActiveSnap,
  snapRect,
  snapResize,
  type AlignRect,
} from './snapGeometry.js';
import {
  MIN_SIZE_PX,
  parseTranslate,
  resizeFrom,
  sizeClass,
  translateClass,
  type ResizeHandle,
  type TransformBox,
  type Translate,
} from './transformGeometry.js';

const OVERLAY_PAD = 8;
const HANDLE_IDS: ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const STYLE_ID = 'interface-kit-transform-styles';
const HANDLE_ATTR = 'data-ik-handle';

const OVERLAY_CSS = `[data-ik-transform] {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  display: none;
}
[data-ik-handle] {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -5px;
  background: #fff;
  border: 1.5px solid #2563eb;
  border-radius: 1px;
  box-sizing: content-box;
  pointer-events: auto;
  touch-action: none;
}
[data-ik-handle='nw'] { top: 0; left: 0; cursor: nwse-resize; }
[data-ik-handle='n']  { top: 0; left: 50%; cursor: ns-resize; }
[data-ik-handle='ne'] { top: 0; right: 0; cursor: nesw-resize; }
[data-ik-handle='e']  { top: 50%; right: 0; cursor: ew-resize; }
[data-ik-handle='se'] { bottom: 0; right: 0; cursor: nwse-resize; }
[data-ik-handle='s']  { bottom: 0; left: 50%; cursor: ns-resize; }
[data-ik-handle='sw'] { bottom: 0; left: 0; cursor: nesw-resize; }
[data-ik-handle='w']  { top: 50%; left: 0; cursor: ew-resize; }
`;

/**
 * Move (drag / arrows) and resize (corner + edge handles) the currently
 * selected InterfaceKit element. Every write goes through
 * `applyStyleGroup` with a Tailwind class so it lands in Pending Changes
 * and the "Copy as prompt" export. `applyStyleGroup([el])` is used on
 * purpose: `applyStyle` would also hit every similar button.
 */
export function enableMoveSelected(
  controller: InterfaceKitController,
  doc: Document,
): () => void {
  const win = doc.defaultView ?? window;

  let kitActive = false;
  let editingText = false;
  let kitDraggingStyle = false;

  // The kit batches style writes into rAF, so getComputedStyle still reports
  // the old value right after applying one. Without this cache two arrow
  // presses in the same frame would both read the same value and the second
  // would overwrite instead of accumulate.
  let lastTranslate: { el: HTMLElement; x: number; y: number } | null = null;
  let lastWidth: { el: HTMLElement; width: number } | null = null;
  let lastHeight: { el: HTMLElement; height: number } | null = null;

  const overlay = createOverlay(doc);
  const styleEl = ensureOverlayStyles(doc);
  doc.body.append(overlay);

  let overlayFrame = 0;

  const unsubscribe = controller.subscribe(onSnapshot);
  onSnapshot(controller.getState());

  function onSnapshot(snapshot: InterfaceKitSnapshot): void {
    kitActive = snapshot.isActive;
    editingText = snapshot.isEditingText;
    kitDraggingStyle = snapshot.isDraggingStyle;

    const properties = new Set(
      snapshot.pendingChanges.map((change) => change.property),
    );
    if (!properties.has('translate')) lastTranslate = null;
    if (!properties.has('width')) lastWidth = null;
    if (!properties.has('height')) lastHeight = null;

    syncOverlayLoop();
  }

  function canTransform(): boolean {
    return kitActive && !editingText;
  }

  function syncOverlayLoop(): void {
    if (canTransform() && controller.getSelectedElement()) {
      if (overlayFrame === 0)
        overlayFrame = win.requestAnimationFrame(tickOverlay);
      return;
    }
    stopOverlay();
  }

  function tickOverlay(): void {
    overlayFrame = 0;
    const el = controller.getSelectedElement();
    if (!canTransform() || !el) {
      hideOverlay();
      return;
    }
    placeOverlay(overlay, el.getBoundingClientRect());
    overlayFrame = win.requestAnimationFrame(tickOverlay);
  }

  function stopOverlay(): void {
    if (overlayFrame !== 0) {
      win.cancelAnimationFrame(overlayFrame);
      overlayFrame = 0;
    }
    hideOverlay();
  }

  function hideOverlay(): void {
    overlay.style.display = 'none';
  }

  function isInsideKitUi(event: Event): boolean {
    return event
      .composedPath()
      .some(
        (target) =>
          target instanceof Element &&
          target.hasAttribute('data-interface-kit'),
      );
  }

  function isOurHandle(event: Event): boolean {
    return event
      .composedPath()
      .some(
        (target) =>
          target instanceof Element && target.hasAttribute(HANDLE_ATTR),
      );
  }

  function offsetOf(el: HTMLElement): {
    translate: Translate;
    wasSet: boolean;
  } {
    if (lastTranslate?.el === el) {
      return {
        translate: { x: lastTranslate.x, y: lastTranslate.y },
        wasSet: true,
      };
    }
    const raw = getComputedStyle(el).translate;
    if (!raw || raw === 'none')
      return { translate: { x: 0, y: 0 }, wasSet: false };
    return { translate: parseTranslate(raw), wasSet: true };
  }

  function sizeOf(el: HTMLElement): {
    width: number;
    height: number;
    widthWasSet: boolean;
    heightWasSet: boolean;
  } {
    const cs = getComputedStyle(el);
    const width =
      lastWidth?.el === el
        ? lastWidth.width
        : Math.round(parseFloat(cs.width) || el.offsetWidth);
    const height =
      lastHeight?.el === el
        ? lastHeight.height
        : Math.round(parseFloat(cs.height) || el.offsetHeight);
    // getComputedStyle always returns the used px width, never "auto", so
    // "was this ours" is the cache: a first-gesture Escape can revert.
    return {
      width,
      height,
      widthWasSet: lastWidth?.el === el,
      heightWasSet: lastHeight?.el === el,
    };
  }

  function moveTo(el: HTMLElement, x: number, y: number): void {
    const nextX = Math.round(x);
    const nextY = Math.round(y);
    lastTranslate = { el, x: nextX, y: nextY };
    controller.applyStyleGroup(
      [el],
      'translate',
      `${nextX}px ${nextY}px`,
      translateClass(nextX, nextY),
    );
  }

  function sizeTo(
    el: HTMLElement,
    width: number,
    height: number,
    axes: { width: boolean; height: boolean },
  ): void {
    if (axes.width) {
      lastWidth = { el, width };
      controller.applyStyleGroup(
        [el],
        'width',
        `${width}px`,
        sizeClass('width', width),
      );
    }
    if (axes.height) {
      lastHeight = { el, height };
      controller.applyStyleGroup(
        [el],
        'height',
        `${height}px`,
        sizeClass('height', height),
      );
    }
  }

  function applyBox(
    el: HTMLElement,
    box: TransformBox,
    axes: { translate: boolean; width: boolean; height: boolean },
  ): void {
    if (axes.translate) moveTo(el, box.x, box.y);
    sizeTo(el, box.width, box.height, axes);
  }

  // --- Gestures ---

  type Gesture =
    | {
        kind: 'move';
        el: HTMLElement;
        started: boolean;
        startX: number;
        startY: number;
        base: Translate;
        baseWasSet: boolean;
        startRect: AlignRect;
        targets: AlignRect[];
      }
    | {
        kind: 'resize';
        el: HTMLElement;
        started: true;
        handle: ResizeHandle;
        startX: number;
        startY: number;
        base: TransformBox;
        startRect: AlignRect;
        targets: AlignRect[];
        widthWasSet: boolean;
        heightWasSet: boolean;
        translateWasSet: boolean;
        axes: { translate: boolean; width: boolean; height: boolean };
      };

  let gesture: Gesture | null = null;
  let lastPointer = { x: 0, y: 0 };
  let prevCursor = '';
  let prevUserSelect = '';
  let bodyStyled = false;

  function beginBodyStyle(cursor: string): void {
    if (bodyStyled) return;
    prevCursor = doc.body.style.cursor;
    prevUserSelect = doc.body.style.userSelect;
    doc.body.style.cursor = cursor;
    doc.body.style.userSelect = 'none';
    bodyStyled = true;
  }

  function restoreBodyStyles(): void {
    if (!bodyStyled) return;
    doc.body.style.cursor = prevCursor;
    doc.body.style.userSelect = prevUserSelect;
    bodyStyled = false;
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

  function handleFromEvent(event: Event): ResizeHandle | null {
    for (const target of event.composedPath()) {
      if (target instanceof Element && target.hasAttribute(HANDLE_ATTR)) {
        const id = target.getAttribute(HANDLE_ATTR);
        if (id && HANDLE_IDS.includes(id as ResizeHandle))
          return id as ResizeHandle;
      }
    }
    return null;
  }

  function onHandlePointerDown(event: PointerEvent): void {
    if (!canTransform() || event.button !== 0) return;
    if (kitDraggingStyle) return;
    const handle = handleFromEvent(event);
    if (!handle) return;

    const el = controller.getSelectedElement();
    if (!el) return;

    event.preventDefault();
    event.stopPropagation();
    lastPointer = { x: event.clientX, y: event.clientY };

    const translate = offsetOf(el);
    const size = sizeOf(el);
    const box = el.getBoundingClientRect();
    const axes = {
      translate: handle.includes('n') || handle.includes('w'),
      width: handle.includes('e') || handle.includes('w'),
      height: handle.includes('n') || handle.includes('s'),
    };

    gesture = {
      kind: 'resize',
      el,
      started: true,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      base: {
        x: translate.translate.x,
        y: translate.translate.y,
        width: size.width,
        height: size.height,
      },
      startRect: {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      },
      targets: collectSnapTargets(doc, el, {
        width: win.innerWidth,
        height: win.innerHeight,
      }),
      widthWasSet: size.widthWasSet,
      heightWasSet: size.heightWasSet,
      translateWasSet: translate.wasSet,
      axes,
    };

    controller.startStyleInteraction();
    beginBodyStyle(cursorFor(handle));
    bindDrag();
  }

  function onPointerDown(event: PointerEvent): void {
    if (!canTransform() || event.button !== 0) return;
    if (kitDraggingStyle) return;
    if (isOurHandle(event)) return;
    if (isInsideKitUi(event)) return;

    const el = controller.getSelectedElement();
    if (!el) return;
    if (!event.composedPath().includes(el)) return;

    lastPointer = { x: event.clientX, y: event.clientY };
    const current = offsetOf(el);
    const box = el.getBoundingClientRect();
    gesture = {
      kind: 'move',
      el,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
      base: current.translate,
      baseWasSet: current.wasSet,
      startRect: {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      },
      targets: collectSnapTargets(doc, el, {
        width: win.innerWidth,
        height: win.innerHeight,
      }),
    };
    bindDrag();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!gesture) return;
    lastPointer = { x: event.clientX, y: event.clientY };

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.kind === 'move') {
      if (!gesture.started) {
        if (Math.hypot(dx, dy) < 3) return;
        gesture.started = true;
        controller.startStyleInteraction();
        beginBodyStyle('move');
      }
      event.preventDefault();
      applyMove(gesture, dx, dy, event.altKey);
      return;
    }

    event.preventDefault();
    applyResize(gesture, dx, dy, event.altKey, event.shiftKey);
  }

  function applyMove(
    current: Extract<Gesture, { kind: 'move' }>,
    dx: number,
    dy: number,
    skipSnap: boolean,
  ): void {
    const proposed: AlignRect = {
      left: current.startRect.left + dx,
      top: current.startRect.top + dy,
      width: current.startRect.width,
      height: current.startRect.height,
    };
    const snap = skipSnap ? NO_SNAP : snapRect(proposed, current.targets);
    setActiveSnap(snap);
    moveTo(current.el, current.base.x + dx + snap.dx, current.base.y + dy + snap.dy);
  }

  function applyResize(
    current: Extract<Gesture, { kind: 'resize' }>,
    dx: number,
    dy: number,
    skipSnap: boolean,
    lockAspect: boolean,
  ): void {
    const next = resizeFrom(current.handle, current.base, dx, dy, {
      minSize: MIN_SIZE_PX,
      lockAspect,
    });
    const proposed: AlignRect = {
      left: current.startRect.left + (next.x - current.base.x),
      top: current.startRect.top + (next.y - current.base.y),
      width: next.width,
      height: next.height,
    };
    const snap = skipSnap
      ? NO_SNAP
      : snapResize(proposed, current.handle, current.targets);
    setActiveSnap(snap);
    applyBox(
      current.el,
      {
        x: next.x + snap.dx,
        y: next.y + snap.dy,
        width: next.width + snap.dWidth,
        height: next.height + snap.dHeight,
      },
      current.axes,
    );
  }

  function replayGesture(altKey: boolean, shiftKey: boolean): void {
    if (!gesture) return;
    const dx = lastPointer.x - gesture.startX;
    const dy = lastPointer.y - gesture.startY;
    if (gesture.kind === 'move') {
      if (!gesture.started) return;
      applyMove(gesture, dx, dy, altKey);
      return;
    }
    applyResize(gesture, dx, dy, altKey, shiftKey);
  }

  function endMoveSnap(): void {
    setActiveSnap(NO_SNAP);
  }

  function onPointerUp(): void {
    unbindDrag();
    restoreBodyStyles();
    endMoveSnap();

    if (gesture && (gesture.kind === 'resize' || gesture.started)) {
      controller.endStyleInteraction();
      swallowNextClick();
    }

    gesture = null;
  }

  function cancelGesture(): void {
    if (!gesture) return;

    const current = gesture;
    unbindDrag();
    restoreBodyStyles();
    endMoveSnap();
    controller.endStyleInteraction();

    if (current.kind === 'move') {
      if (current.baseWasSet) {
        moveTo(current.el, current.base.x, current.base.y);
      } else {
        controller.revertPropertyGroup([current.el], 'translate');
        lastTranslate = null;
      }
    } else {
      revertResize(current);
    }

    gesture = null;
  }

  function revertResize(current: Extract<Gesture, { kind: 'resize' }>): void {
    if (current.axes.translate) {
      if (current.translateWasSet) {
        moveTo(current.el, current.base.x, current.base.y);
      } else {
        controller.revertPropertyGroup([current.el], 'translate');
        lastTranslate = null;
      }
    }
    if (current.axes.width) {
      if (current.widthWasSet) {
        sizeTo(current.el, current.base.width, current.base.height, {
          width: true,
          height: false,
        });
      } else {
        controller.revertPropertyGroup([current.el], 'width');
        lastWidth = null;
      }
    }
    if (current.axes.height) {
      if (current.heightWasSet) {
        sizeTo(current.el, current.base.width, current.base.height, {
          width: false,
          height: true,
        });
      } else {
        controller.revertPropertyGroup([current.el], 'height');
        lastHeight = null;
      }
    }
  }

  function swallowNextClick(): void {
    const onClick = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      win.removeEventListener('click', onClick, true);
    };
    win.addEventListener('click', onClick, true);
    setTimeout(() => win.removeEventListener('click', onClick, true), 0);
  }

  overlay.addEventListener('pointerdown', onHandlePointerDown, true);
  doc.addEventListener('pointerdown', onPointerDown, true);

  function isTextInput(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      target.isContentEditable
    );
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (gesture) {
        event.preventDefault();
        event.stopPropagation();
        cancelGesture();
      }
      return;
    }

    if (event.key === 'Alt' && gesture) {
      replayGesture(true, event.shiftKey);
      return;
    }

    if (!canTransform()) return;
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'ArrowDown'
    ) {
      return;
    }

    const el = controller.getSelectedElement();
    if (!el) return;
    if (isInsideKitUi(event)) return;
    if (isTextInput(event.target)) return;

    const step = event.shiftKey ? 10 : 1;
    const { translate } = offsetOf(el);
    let { x, y } = translate;

    if (event.key === 'ArrowLeft') x -= step;
    else if (event.key === 'ArrowRight') x += step;
    else if (event.key === 'ArrowUp') y -= step;
    else if (event.key === 'ArrowDown') y += step;

    event.preventDefault();
    event.stopPropagation();
    moveTo(el, x, y);
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Alt' && gesture) {
      replayGesture(false, event.shiftKey);
    }
  }

  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('keyup', onKeyUp, true);

  return () => {
    unsubscribe();
    stopOverlay();
    unbindDrag();
    restoreBodyStyles();
    endMoveSnap();
    overlay.removeEventListener('pointerdown', onHandlePointerDown, true);
    doc.removeEventListener('pointerdown', onPointerDown, true);
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('keyup', onKeyUp, true);
    overlay.remove();
    styleEl.remove();
  };
}

function cursorFor(handle: ResizeHandle): string {
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

function createOverlay(doc: Document): HTMLDivElement {
  const box = doc.createElement('div');
  box.setAttribute('data-interface-kit', '');
  box.setAttribute('data-ik-transform', '');
  for (const id of HANDLE_IDS) {
    const handle = doc.createElement('div');
    handle.setAttribute('data-interface-kit', '');
    handle.setAttribute(HANDLE_ATTR, id);
    box.append(handle);
  }
  return box;
}

function ensureOverlayStyles(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = OVERLAY_CSS;
  doc.head.append(style);
  return style;
}

function placeOverlay(overlay: HTMLElement, rect: DOMRect): void {
  overlay.style.display = 'block';
  overlay.style.left = `${rect.left - OVERLAY_PAD}px`;
  overlay.style.top = `${rect.top - OVERLAY_PAD}px`;
  overlay.style.width = `${rect.width + OVERLAY_PAD * 2}px`;
  overlay.style.height = `${rect.height + OVERLAY_PAD * 2}px`;
}
