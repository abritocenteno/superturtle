import { describe, it, expect } from 'vitest';
import { createInterpreter } from '../src/interpreter.ts';
import { createDriver, SPEEDS } from '../src/driver.ts';
import { Turtle } from '../src/turtle.ts';
import { LogoError } from '../src/errors.ts';
import { formatError } from '../src/messages.ts';
import type { Clock, Surface, Host, Segment, TurtleState } from '../src/types.ts';

/**
 * A Clock with no real time in it: frames only run when the test pumps them,
 * and the "current time" is whatever the test has advanced it to. This is the
 * only way to assert on the driver's pacing — budgets, `wacht`, cancellation —
 * without sleeping in the suite.
 */
function fakeClock(frameMs = 16, perCallMs = 0) {
  let t = 0;
  let queue: (() => void)[] = [];
  const clock: Clock = {
    // `perCallMs` makes time pass *inside* a frame as well, which is what lets
    // a test drive the driver's frame budget.
    now: () => { t += perCallMs; return t; },
    schedule: (cb) => { queue.push(cb); },
  };
  /** Run scheduled frames until nothing is scheduled or `maxFrames` is hit. */
  function pump(maxFrames = 100_000): number {
    let n = 0;
    while (queue.length > 0 && n < maxFrames) {
      const batch = queue;
      queue = [];
      for (const cb of batch) {
        t += frameMs;
        n++;
        cb();
      }
    }
    return n;
  }
  return { clock, pump, elapsed: () => t, pending: () => queue.length };
}

function rig(speed = SPEEDS[SPEEDS.length - 1]) {
  const segments: Segment[] = [];
  const printed: string[] = [];
  let lastTurtle: TurtleState | null | undefined;
  let turtleRenders = 0;

  const surface: Surface = {
    width: 1200,
    height: 900,
    clearInk() { segments.length = 0; },
    drawSegment(s) { segments.push(s); },
    renderTurtle(s) { lastTurtle = s; turtleRenders++; },
    setGridVisible(_: boolean) {},
  };
  const host: Host = {
    print: (s) => printed.push(s),
    mark: () => {},
    penChanged: () => {},
  };
  const turtle = new Turtle(surface);
  turtle.stepLen = speed;

  function run(src: string, frameMs = 16, perCallMs = 0) {
    const fc = fakeClock(frameMs, perCallMs);
    let done = 0;
    let error: unknown;
    const handle = createDriver(
      createInterpreter(turtle, host).run(src),
      turtle,
      surface,
      fc.clock,
      { onDone: () => { done++; }, onError: (e) => { error = e; } },
    );
    return {
      handle,
      pump: fc.pump,
      elapsed: fc.elapsed,
      pending: fc.pending,
      done: () => done,
      error: () => error,
    };
  }

  return { run, turtle, segments, printed, lastTurtle: () => lastTurtle, turtleRenders: () => turtleRenders };
}

describe('driver (fake clock)', () => {
  it('runs an instant drawing to completion', () => {
    const r = rig();
    const run = r.run('herhaal 4 [ vooruit 100 rechts 90 ]');
    const frames = run.pump();
    expect(run.done()).toBe(1);
    expect(run.error()).toBeUndefined();
    expect(r.segments.length).toBe(4);
    expect(frames).toBe(1);          // no per-segment frame at max speed
    expect(run.pending()).toBe(0);   // and nothing left scheduled
    expect(run.handle.running()).toBe(false);
  });

  it('animates one segment per frame at the slowest speed', () => {
    const r = rig(SPEEDS[0]);
    const run = r.run('herhaal 4 [ vooruit 100 rechts 90 ]');
    const frames = run.pump();
    expect(run.done()).toBe(1);
    // 100 units in steps of 3 = 34 segments a side.
    expect(r.segments.length).toBe(136);
    expect(frames).toBeGreaterThan(r.segments.length);
  });

  it('respects the frame budget on a big instant drawing', () => {
    // Every now() call advances the clock, so the 12 ms budget expires mid-run
    // and the driver has to spread the work over several frames.
    const r = rig();
    const run = r.run('herhaal 200 [ vooruit 10 rechts 90 ]', 0, 1);
    const frames = run.pump();
    expect(run.done()).toBe(1);
    expect(r.segments.length).toBe(200);
    expect(frames).toBeGreaterThan(1);
  });

  it('pauses for wacht without blocking', () => {
    const r = rig();
    const run = r.run('vooruit 10 wacht 500 vooruit 10');
    // First frame draws up to the wait and schedules the next one.
    run.pump(1);
    expect(r.segments.length).toBe(1);
    expect(run.done()).toBe(0);
    run.pump();
    expect(run.done()).toBe(1);
    expect(r.segments.length).toBe(2);
    expect(run.elapsed()).toBeGreaterThanOrEqual(500);
  });

  it('stops cleanly halfway through', () => {
    const r = rig(SPEEDS[0]);
    const run = r.run('herhaal 4 [ vooruit 100 rechts 90 ]');
    run.pump(5);
    const drawn = r.segments.length;
    expect(drawn).toBeGreaterThan(0);
    expect(run.handle.running()).toBe(true);

    run.handle.stop();
    run.pump();
    expect(r.segments.length).toBe(drawn);  // nothing drawn after stop
    expect(run.done()).toBe(0);             // and no completion callback
    expect(run.handle.running()).toBe(false);
  });

  it('reports errors through onError, formatted for the child', () => {
    const r = rig();
    const run = r.run('vooruit 10 zwiep 10');
    run.pump();
    const e = run.error();
    expect(e).toBeInstanceOf(LogoError);
    expect((e as LogoError).key).toBe('unknown');
    expect((e as LogoError).line).toBe(1);
    expect(formatError(e, 'nl')).toContain('zwiep');
    expect(run.done()).toBe(0);
    expect(r.segments.length).toBe(1);      // work before the error is kept
    expect(run.handle.running()).toBe(false);
  });

  it('paints the turtle on the last frame of a run', () => {
    const r = rig();
    const run = r.run('herhaal 4 [ vooruit 100 rechts 90 ] rechts 45');
    run.pump();
    expect(r.turtleRenders()).toBeGreaterThan(0);
    expect(r.lastTurtle()).not.toBeNull();
    expect(r.lastTurtle()!.heading).toBeCloseTo(45);
  });

  it('renders nothing for a hidden turtle', () => {
    const r = rig();
    const run = r.run('verberg vooruit 10');
    run.pump();
    expect(r.lastTurtle()).toBeNull();
  });

  it('passes print output to the host', () => {
    const r = rig();
    const run = r.run('schrijf 2 + 3 * 4');
    run.pump();
    expect(r.printed).toEqual(['14']);
  });
});
