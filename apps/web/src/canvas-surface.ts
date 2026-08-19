import type { Surface, Segment, TurtleState } from '@schildpad/core';

/**
 * Canvas2D implementation of the core Surface.
 *
 * Three stacked canvases: a "grid" layer, an "ink" layer that accumulates the
 * drawing, and a "turtle" layer redrawn every frame for the sprite. The grid is
 * its own layer so that clearing the ink — or resizing the sheet — never has to
 * touch it, and so that the two can be blitted independently. Logical
 * coordinates have their origin at the centre with y pointing up; this class
 * owns the mapping to device pixels. The mobile app implements this same
 * interface over Skia — keep the two in sync when you change the coordinate
 * model or the sprite.
 *
 * The logical HEIGHT is fixed and the logical width follows the shape of the
 * sheet (see `fit`). A wider window therefore means more room to draw sideways,
 * never a stretched drawing, and `vooruit 100` covers the same fraction of the
 * paper's height on every screen. Past `MAX_LOGICAL_W` the sheet is letterboxed
 * instead (`object-fit`), so a drawing never distorts.
 */

const GRID = '#DCE3DE';
const AXIS = '#BFCBC4';
const LOGICAL_H = 900;
const MIN_LOGICAL_W = 200;
const MAX_LOGICAL_W = 4096;   // three backing stores this wide are already ~44 MB


export class CanvasSurface implements Surface {
  width: number;
  readonly height = LOGICAL_H;

  private grid: CanvasRenderingContext2D;
  private ink: CanvasRenderingContext2D;
  private turtle: CanvasRenderingContext2D;
  private gridOn = true;

  constructor(
    gridCanvas: HTMLCanvasElement,
    inkCanvas: HTMLCanvasElement,
    turtleCanvas: HTMLCanvasElement,
  ) {
    this.width = inkCanvas.width;
    const gr = gridCanvas.getContext('2d');
    const ink = inkCanvas.getContext('2d');
    const tu = turtleCanvas.getContext('2d');
    if (!gr || !ink || !tu) throw new Error('2D context unavailable');
    this.grid = gr;
    this.ink = ink;
    this.turtle = tu;
    this.paintGrid();
  }

  /**
   * Match the logical space to the shape of the box the sheet is displayed in.
   * Called on boot, on resize and while the split is dragged, so it has to be
   * cheap and it has to keep the drawing: both the old and the new space have
   * their origin at the centre, so the ink is a straight centred blit with no
   * scaling. Returns true if anything changed.
   */
  fit(cssW: number, cssH: number): boolean {
    if (cssW <= 0 || cssH <= 0) return false;
    const want = Math.round((LOGICAL_H * cssW) / cssH);
    const w = Math.min(MAX_LOGICAL_W, Math.max(MIN_LOGICAL_W, want));
    if (w === this.width) return false;

    const keep = document.createElement('canvas');
    keep.width = this.width;
    keep.height = LOGICAL_H;
    keep.getContext('2d')!.drawImage(this.ink.canvas, 0, 0);
    const dx = Math.round((w - this.width) / 2);

    this.width = w;
    for (const c of [this.grid.canvas, this.ink.canvas, this.turtle.canvas]) {
      c.width = w;                 // resizing a canvas also resets its context
      c.height = LOGICAL_H;
    }
    this.ink.drawImage(keep, dx, 0);
    this.paintGrid();
    return true;
  }

  private px(x: number): number { return this.width / 2 + x; }
  private py(y: number): number { return this.height / 2 - y; }

  setGridVisible(on: boolean): void {
    this.gridOn = on;
    this.paintGrid();       // its own layer, so the drawing stays put
  }

  clearInk(): void {
    this.ink.clearRect(0, 0, this.width, this.height);
  }

  private paintGrid(): void {
    const { grid: ink, width: W, height: H } = this;
    ink.clearRect(0, 0, W, H);
    if (!this.gridOn) return;
    ink.save();
    ink.strokeStyle = GRID;
    ink.lineWidth = 1;
    ink.beginPath();
    for (let x = W / 2; x < W; x += 50) { ink.moveTo(x + 0.5, 0); ink.lineTo(x + 0.5, H); }
    for (let x = W / 2 - 50; x > 0; x -= 50) { ink.moveTo(x + 0.5, 0); ink.lineTo(x + 0.5, H); }
    for (let y = H / 2; y < H; y += 50) { ink.moveTo(0, y + 0.5); ink.lineTo(W, y + 0.5); }
    for (let y = H / 2 - 50; y > 0; y -= 50) { ink.moveTo(0, y + 0.5); ink.lineTo(W, y + 0.5); }
    ink.stroke();
    ink.strokeStyle = AXIS;
    ink.beginPath();
    ink.moveTo(W / 2 - 14, H / 2 + 0.5); ink.lineTo(W / 2 + 14, H / 2 + 0.5);
    ink.moveTo(W / 2 + 0.5, H / 2 - 14); ink.lineTo(W / 2 + 0.5, H / 2 + 14);
    ink.stroke();
    ink.restore();
  }

  drawSegment(s: Segment): void {
    const { ink } = this;
    ink.save();
    ink.strokeStyle = s.color;
    ink.lineWidth = s.width;
    ink.lineCap = 'round';
    ink.lineJoin = 'round';
    ink.beginPath();
    ink.moveTo(this.px(s.x0), this.py(s.y0));
    ink.lineTo(this.px(s.x1), this.py(s.y1));
    ink.stroke();
    ink.restore();
  }

  renderTurtle(state: TurtleState | null): void {
    const tu = this.turtle;
    tu.clearRect(0, 0, this.width, this.height);
    if (!state) return;

    tu.save();
    tu.translate(this.px(state.x), this.py(state.y));
    tu.rotate((state.heading * Math.PI) / 180);

    const body = state.color === '#FCFBF7' ? '#33A06B' : state.color;
    tu.fillStyle = body;
    tu.strokeStyle = 'rgba(255,255,255,.85)';
    tu.lineWidth = 2;

    // flippers
    tu.beginPath();
    for (const [fx, fy] of [[-13, -9], [13, -9], [-12, 9], [12, 9]]) {
      tu.moveTo(fx, fy); tu.arc(fx, fy, 6.2, 0, Math.PI * 2);
    }
    tu.fill();
    // head
    tu.beginPath(); tu.arc(0, -17, 5.6, 0, Math.PI * 2); tu.fill();
    // shell
    tu.beginPath(); tu.ellipse(0, 0, 12.5, 15.5, 0, 0, Math.PI * 2); tu.fill(); tu.stroke();
    // shell plates
    tu.globalAlpha = 0.55;
    tu.beginPath();
    tu.moveTo(0, -15.5); tu.lineTo(0, 15.5);
    tu.moveTo(-11.4, -5); tu.lineTo(11.4, -5);
    tu.moveTo(-11.4, 5.5); tu.lineTo(11.4, 5.5);
    tu.stroke();
    tu.globalAlpha = 1;
    // direction pip
    tu.fillStyle = 'rgba(255,255,255,.9)';
    tu.beginPath(); tu.arc(0, -21.5, 1.8, 0, Math.PI * 2); tu.fill();
    tu.restore();
  }

  /** Export the current drawing as a PNG data URL, with a paper background. */
  toPNG(background = '#FCFBF7'): string {
    const out = document.createElement('canvas');
    out.width = this.width; out.height = this.height;
    const c = out.getContext('2d')!;
    c.fillStyle = background;
    c.fillRect(0, 0, this.width, this.height);
    c.drawImage(this.grid.canvas, 0, 0);
    c.drawImage(this.ink.canvas, 0, 0);
    return out.toDataURL('image/png');
  }
}

/** A Clock backed by requestAnimationFrame + performance.now (web driver). */
export function webClock() {
  return {
    now: () => performance.now(),
    schedule: (cb: () => void) => requestAnimationFrame(cb),
  };
}
