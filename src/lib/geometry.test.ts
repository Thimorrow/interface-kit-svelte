// @ts-nocheck — node:test types are not in the Svelte tsconfig.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { measureDistances } from './distanceGeometry.js';
import { styleFromDistance } from './distanceApply.js';
import { NO_SNAP, SNAP_THRESHOLD_PX, snapRect } from './snapGeometry.js';
import { chromeHint, isApplePlatform, skipSnapFrom } from './kitModifiers.js';

const box = (
  left: number,
  top: number,
  width: number,
  height: number,
) => ({ left, top, width, height });

describe('snapRect', () => {
  it('snaps a 5px offset onto a sibling edge', () => {
    const moving = box(205, 0, 200, 80);
    const target = box(0, 0, 200, 80);
    const snap = snapRect(moving, [target]);
    assert.equal(snap.dx, -5);
    assert.ok(snap.vertical.includes('left'));
  });

  it('does not snap a 7px offset', () => {
    const moving = box(207, 0, 200, 80);
    const target = box(0, 0, 200, 80);
    assert.deepEqual(snapRect(moving, [target]), NO_SNAP);
  });

  it('uses a 6px threshold', () => {
    assert.equal(SNAP_THRESHOLD_PX, 6);
  });
});

describe('measureDistances', () => {
  it('returns the outer gap between two boxes', () => {
    const a = box(0, 0, 100, 40);
    const b = box(118, 0, 100, 40);
    const marks = measureDistances(a, b);
    assert.equal(marks.length, 1);
    assert.equal(marks[0]?.px, 18);
    assert.equal(marks[0]?.axis, 'x');
    assert.equal(marks[0]?.nested, false);
  });

  it('returns inset marks when one box contains the other', () => {
    const outer = box(0, 0, 200, 120);
    const inner = box(12, 12, 176, 96);
    const marks = measureDistances(outer, inner);
    assert.equal(marks.length, 4);
    assert.ok(marks.every((mark) => mark.nested && mark.px === 12));
  });
});

describe('styleFromDistance', () => {
  it('writes margin-right when the selection sits to the left', () => {
    const selected = box(0, 0, 100, 40);
    const hovered = box(118, 0, 100, 40);
    const [mark] = measureDistances(selected, hovered);
    assert.ok(mark);
    const write = styleFromDistance(selected, hovered, mark);
    assert.equal(write.property, 'margin-right');
    assert.equal(write.value, '18px');
    assert.equal(write.tailwindClass, 'mr-[18px]');
  });

  it('writes padding-top when the selection contains the hover', () => {
    const selected = box(0, 0, 200, 120);
    const hovered = box(12, 12, 176, 96);
    const marks = measureDistances(selected, hovered);
    const top = marks.find((mark) => mark.axis === 'y' && mark.y1 === 0);
    assert.ok(top);
    if (!top) return;
    const write = styleFromDistance(selected, hovered, top);
    assert.equal(write.property, 'padding-top');
    assert.equal(write.tailwindClass, 'pt-[12px]');
  });
});

describe('kitModifiers', () => {
  it('treats Mac as Apple', () => {
    assert.equal(isApplePlatform({ platform: 'MacIntel' }), true);
    assert.equal(isApplePlatform({ platform: 'Win32' }), false);
  });

  it('skips snap with ⌘ on Mac and Ctrl elsewhere', () => {
    assert.equal(skipSnapFrom({ metaKey: true, ctrlKey: false }, true), true);
    assert.equal(skipSnapFrom({ metaKey: false, ctrlKey: true }, true), false);
    assert.equal(skipSnapFrom({ metaKey: false, ctrlKey: true }, false), true);
  });

  it('labels the hint with ⌘ on Mac', () => {
    assert.equal(chromeHint(false, true), '⌘ free · esc parent · ↵ child');
    assert.equal(chromeHint(true, true), '⌘ free · esc cancel');
    assert.equal(chromeHint(false, false), 'Ctrl free · esc parent · ↵ child');
  });
});
