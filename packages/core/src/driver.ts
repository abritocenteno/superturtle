import { LogoError } from './errors.ts';
import type { Clock, Surface } from './types.ts';
import type { Turtle } from './turtle.ts';

/**
 * Drives a running interpreter frame by frame. This is the one piece of timing
 * logic shared across platforms: web injects a Clock backed by
 * requestAnimationFrame + performance.now; mobile injects one backed by its own
 * frame callback. The driver pulls generator values and decides when to paint
 * and when to pause:
 *
 *   'draw'      a segment was drawn; if animating, paint and yield a frame
 *   'tick'      a loop iteration boundary; lets long instant runs stay cancellable
 *   { wait: n } pause n ms before continuing (the `wacht` / `wait` command)
 *
 * A per-frame time budget keeps instant (max-speed) runs from blocking the UI
 * thread on very large drawings.
 */

/** stepLen per speed setting 1..5; Infinity = instant. */
export const SPEEDS = [3, 8, 18, 45, Infinity];

export interface DriverCallbacks {
  onDone?: () => void;
  onError?: (err: unknown) => void;
}

export interface DriverHandle {
  stop(): void;
  running(): boolean;
}

export function createDriver(
  iter: Generator<unknown>,
  turtle: Turtle,
  surface: Surface,
  clock: Clock,
  cb: DriverCallbacks = {},
  frameBudgetMs = 12,
): DriverHandle {
  let alive = true;
  let waitUntil = 0;

  const renderTurtle = () => surface.renderTurtle(turtle.visible ? turtle.state() : null);

  function frame(): void {
    if (!alive) return;
    const now = clock.now();
    if (now < waitUntil) { clock.schedule(frame); return; }

    const budget = now + frameBudgetMs;
    try {
      while (true) {
        const r = iter.next();
        if (r.done) { alive = false; renderTurtle(); cb.onDone?.(); return; }
        const v = r.value as unknown;
        if (v && typeof v === 'object' && 'wait' in (v as Record<string, unknown>)) {
          waitUntil = clock.now() + (v as { wait: number }).wait;
          break;
        }
        if (v === 'draw' && isFinite(turtle.stepLen)) break;
        if (clock.now() > budget) break;
      }
    } catch (e) {
      alive = false;
      renderTurtle();
      cb.onError?.(e);
      return;
    }
    renderTurtle();
    clock.schedule(frame);
  }

  clock.schedule(frame);

  return {
    stop() { alive = false; },
    running() { return alive; },
  };
}

/** Re-export so callers can format runaway/guard errors consistently. */
export { LogoError };
