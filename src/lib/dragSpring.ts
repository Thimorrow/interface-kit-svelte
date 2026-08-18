/**
 * Pointer-follow spring in Motion units (stiffness / damping / mass).
 * Closed-form so the stiff, light-mass copy-thumbnail config stays stable.
 */

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

/** Same numbers as the Motion `useSpring` copy-thumbnail. Light mass, no overshoot. */
export const DRAG_SPRING: SpringConfig = {
  stiffness: 400,
  damping: 40,
  mass: 0.1,
};

/** Motion defaults: stop when close and slow enough, then snap to the target. */
export const REST_SPEED = 2;
export const REST_DELTA = 0.5;

const MAX_DT = 0.064;
const CRITICAL_ZETA = 1e-5;

export interface SpringAxis {
  current: number;
  target: number;
  velocity: number;
}

export function createAxis(value: number): SpringAxis {
  return { current: value, target: value, velocity: 0 };
}

export function jumpAxis(axis: SpringAxis, value: number): void {
  axis.current = value;
  axis.target = value;
  axis.velocity = 0;
}

export function tickAxis(
  axis: SpringAxis,
  dt: number,
  config: SpringConfig = DRAG_SPRING,
): boolean {
  if (axis.current === axis.target && axis.velocity === 0) return true;

  const time = Math.min(Math.max(dt, 0), MAX_DT);
  const omega = Math.sqrt(config.stiffness / config.mass);
  const zeta =
    config.damping / (2 * Math.sqrt(config.stiffness * config.mass));
  const x0 = axis.current - axis.target;
  const v0 = axis.velocity;
  const next = integrate(x0, v0, time, omega, zeta);

  axis.current = axis.target + next.x;
  axis.velocity = next.v;

  const settled =
    Math.abs(axis.velocity) < REST_SPEED &&
    Math.abs(axis.current - axis.target) < REST_DELTA;

  if (!settled) return false;
  axis.current = axis.target;
  axis.velocity = 0;
  return true;
}

export function tickAxes(
  axes: SpringAxis[],
  dt: number,
  config: SpringConfig = DRAG_SPRING,
): boolean {
  let settled = true;
  for (const axis of axes) {
    if (!tickAxis(axis, dt, config)) settled = false;
  }
  return settled;
}

export function prefersReducedMotion(win: Window): boolean {
  return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function integrate(
  x0: number,
  v0: number,
  dt: number,
  omega: number,
  zeta: number,
): { x: number; v: number } {
  if (zeta < 1 - CRITICAL_ZETA) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega * dt);
    const cos = Math.cos(wd * dt);
    const sin = Math.sin(wd * dt);
    const c1 = x0;
    const c2 = (v0 + zeta * omega * x0) / wd;
    const x = envelope * (c1 * cos + c2 * sin);
    const v =
      -zeta * omega * x + envelope * (-c1 * wd * sin + c2 * wd * cos);
    return { x, v };
  }

  if (zeta > 1 + CRITICAL_ZETA) {
    const root = omega * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega + root;
    const r2 = -zeta * omega - root;
    const c2 = (v0 - r1 * x0) / (r2 - r1);
    const c1 = x0 - c2;
    const e1 = Math.exp(r1 * dt);
    const e2 = Math.exp(r2 * dt);
    return { x: c1 * e1 + c2 * e2, v: c1 * r1 * e1 + c2 * r2 * e2 };
  }

  const envelope = Math.exp(-omega * dt);
  const c2 = v0 + omega * x0;
  return {
    x: envelope * (x0 + c2 * dt),
    v: envelope * (v0 * (1 - omega * dt) + x0 * (-omega * omega * dt)),
  };
}
