// @ts-nocheck — node:test types are not in the Svelte tsconfig.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createAxis,
  jumpAxis,
  tickAxis,
  tickAxes,
} from './dragSpring.js';

const DT = 1 / 60;

function tickUntilRest(axis, frames = 180) {
  for (let i = 0; i < frames; i++) {
    if (tickAxis(axis, DT)) return i;
  }
  return frames;
}

describe('dragSpring', () => {
  it('starts at rest on the given value', () => {
    const axis = createAxis(12);
    assert.equal(axis.current, 12);
    assert.equal(axis.target, 12);
    assert.equal(axis.velocity, 0);
    assert.equal(tickAxis(axis, DT), true);
  });

  it('moves toward the target instead of jumping', () => {
    const axis = createAxis(0);
    axis.target = 100;
    tickAxis(axis, DT);
    assert.ok(axis.current > 0);
    assert.ok(axis.current < 40);
    assert.ok(axis.velocity !== 0);
  });

  it('settles exactly on the target', () => {
    const axis = createAxis(0);
    axis.target = 80;
    const frames = tickUntilRest(axis);
    assert.ok(frames < 180);
    assert.equal(axis.current, 80);
    assert.equal(axis.velocity, 0);
  });

  it('jump snaps without leftover velocity', () => {
    const axis = createAxis(0);
    axis.target = 50;
    tickAxis(axis, DT);
    jumpAxis(axis, 8);
    assert.equal(axis.current, 8);
    assert.equal(axis.target, 8);
    assert.equal(axis.velocity, 0);
    assert.equal(tickAxis(axis, DT), true);
  });

  it('retargets from the current position', () => {
    const axis = createAxis(0);
    axis.target = 100;
    for (let i = 0; i < 8; i++) tickAxis(axis, DT);
    const before = axis.current;
    axis.target = 0;
    tickAxis(axis, DT);
    assert.ok(Math.abs(axis.current - before) < 30);
    assert.ok(axis.current < before);
  });

  it('does not overshoot with the drag config', () => {
    const axis = createAxis(0);
    axis.target = 100;
    for (let i = 0; i < 60; i++) {
      tickAxis(axis, DT);
      assert.ok(axis.current <= 100 + 1e-6);
    }
  });

  it('tickAxes waits until every axis is at rest', () => {
    const x = createAxis(0);
    const y = createAxis(0);
    x.target = 40;
    y.target = 12;
    assert.equal(tickAxes([x, y], DT), false);
    for (let i = 0; i < 180; i++) {
      if (tickAxes([x, y], DT)) {
        assert.equal(x.current, 40);
        assert.equal(y.current, 12);
        return;
      }
    }
    assert.fail('spring did not settle');
  });
});
