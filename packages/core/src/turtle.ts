import { LogoError } from './errors.ts';
import { resolveColor } from './colors.ts';
import type { Surface, TurtleState } from './types.ts';

/**
 * The turtle model. Holds position/heading/pen state and the geometry of
 * moving and turning. It never touches a canvas directly — every line it draws
 * goes to the injected Surface as a logical-coordinate Segment. That is the one
 * seam that lets the same movement code animate on Canvas2D and on Skia.
 *
 * `move` and `goTo` are generators: they yield 'draw' after each sub-segment so
 * the driver can paint a frame and, if animating, pause. `stepLen` is the
 * animation granularity in logical units per frame; Infinity means "instant".
 */
export class Turtle {
  x = 0;
  y = 0;
  heading = 0;         // 0 = up, clockwise positive
  pen = true;
  visible = true;
  color = '#1B2430';
  width = 3;
  stepLen = 16;

  private surface: Surface;

  constructor(surface: Surface) {
    this.surface = surface;
  }

  state(): TurtleState {
    return {
      x: this.x, y: this.y, heading: this.heading,
      pen: this.pen, visible: this.visible,
      color: this.color, width: this.width,
    };
  }

  reset(): void {
    this.x = 0; this.y = 0; this.heading = 0;
    this.pen = true; this.visible = true;
    this.color = '#1B2430'; this.width = 3;
  }

  clear(): void {
    this.surface.clearInk();
  }

  home(): void {
    this.x = 0; this.y = 0; this.heading = 0;
  }

  turn(deg: number): void {
    this.heading = ((this.heading + deg) % 360 + 360) % 360;
  }

  setColor(v: unknown, line: number): void {
    const c = resolveColor(v);
    if (!c) throw new LogoError('nocolor', line, { v: String(v) });
    this.color = c;
  }

  private segment(x1: number, y1: number): void {
    this.surface.drawSegment({
      x0: this.x, y0: this.y, x1, y1,
      color: this.color, width: this.width,
    });
  }

  *move(dist: number): Generator<string> {
    const rad = (this.heading * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);
    const total = Math.abs(dist);
    const sign = Math.sign(dist);
    if (total === 0) return;

    const step = this.stepLen;
    if (!isFinite(step)) {
      const x1 = this.x + dx * dist;
      const y1 = this.y + dy * dist;
      if (this.pen) this.segment(x1, y1);
      this.x = x1; this.y = y1;
      yield 'tick';
      return;
    }
    let done = 0;
    while (done < total) {
      const seg = Math.min(step, total - done);
      const x1 = this.x + dx * seg * sign;
      const y1 = this.y + dy * seg * sign;
      if (this.pen) this.segment(x1, y1);
      this.x = x1; this.y = y1;
      done += seg;
      yield 'draw';
    }
  }

  *goTo(x: number, y: number): Generator<string> {
    if (this.pen) this.segment(x, y);
    this.x = x; this.y = y;
    yield 'draw';
  }
}
