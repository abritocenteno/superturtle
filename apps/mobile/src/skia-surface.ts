import type { Surface, Segment, TurtleState } from '@schildpad/core';

/**
 * Skia implementation of the core Surface for React Native / Expo.
 *
 * Web's Canvas2D is immediate-mode: drawSegment paints a pixel and forgets it.
 * React Native Skia (@shopify/react-native-skia) renders declaratively from a
 * component tree, so this Surface instead RETAINS the draw operations and
 * notifies a listener; a <Canvas> component subscribes and re-renders the
 * accumulated segments plus the turtle. The core driver and interpreter stay
 * byte-for-byte identical — only this seam differs from web.
 *
 * Coordinate model matches web exactly: logical origin at centre, y up. The
 * React component maps logical -> device using the same px()/py() as
 * CanvasSurface (share those helpers if you extract them).
 *
 * The snapshot contract matters here. `useSyncExternalStore` compares snapshots
 * with Object.is and re-reads on every render, so `snapshot()` MUST return the
 * same object until something actually changes — building a fresh one per call
 * spins React in an infinite render loop. So state changes go through commit(),
 * which swaps in one new snapshot object and then notifies.
 *
 * `inkVersion` bumps only when the ink layer changes, never when the turtle
 * moves. That lets the renderer rebuild its Skia paths on ink changes alone
 * while still re-rendering the sprite every frame.
 *
 * TODO(you, in Code):
 *   - Batch drawSegment notifications to one commit per driver frame for large
 *     drawings (the driver can paint many segments in a single frame at speed 5).
 *   - Decide retained vs. offscreen SkSurface. Retained <Path> list is simplest
 *     and matches this class; an imperative SkSurface is faster for >5k segments.
 *   - Render the grid and the turtle sprite (port the shapes from
 *     apps/web/src/canvas-surface.ts renderTurtle()).
 */

/** What the renderer reads. One stable object per state change. */
export interface SkiaSnapshot {
  /** Bumps only when the ink layer changes (draw/clear), not when the turtle moves. */
  inkVersion: number;
  segments: readonly Segment[];
  grid: boolean;
  turtle: TurtleState | null;
}

export class SkiaSurface implements Surface {
  readonly width: number;
  readonly height: number;

  private segments: Segment[] = [];
  private gridOn = true;
  private turtleState: TurtleState | null = null;
  private inkVersion = 0;
  private listeners = new Set<() => void>();
  private snap: SkiaSnapshot;

  constructor(width = 1200, height = 900) {
    this.width = width;
    this.height = height;
    this.snap = { inkVersion: 0, segments: this.segments, grid: true, turtle: null };
  }

  /** Subscribe the React <Canvas> to redraw requests. Returns an unsubscribe. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /**
   * Stable snapshot for useSyncExternalStore: the same object identity until
   * commit() replaces it. Never build a new object here.
   */
  snapshot(): SkiaSnapshot {
    return this.snap;
  }

  private commit(): void {
    this.snap = {
      inkVersion: this.inkVersion,
      segments: this.segments,
      grid: this.gridOn,
      turtle: this.turtleState,
    };
    for (const fn of this.listeners) fn();
  }

  setGridVisible(on: boolean): void {
    this.gridOn = on;
    this.inkVersion++;
    this.commit();
  }

  clearInk(): void {
    this.segments = [];
    this.inkVersion++;
    this.commit();
  }

  drawSegment(seg: Segment): void {
    this.segments.push(seg);
    this.inkVersion++;
    this.commit();
  }

  renderTurtle(state: TurtleState | null): void {
    this.turtleState = state;
    this.commit();
  }
}

/**
 * A Clock for the core driver on React Native. RN provides a global
 * requestAnimationFrame, so this mirrors the web clock. If you prefer to keep
 * animation off the JS thread, back this with a Reanimated frame callback.
 */
export function nativeClock() {
  // `performance` is not in the RN type surface (and not guaranteed at runtime
  // on older engines), so reach for it defensively rather than via globalThis's
  // index signature, which does not typecheck under `types: [react, react-native]`.
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return {
    now: () => perf?.now() ?? Date.now(),
    schedule: (cb: () => void) => requestAnimationFrame(cb),
  };
}
