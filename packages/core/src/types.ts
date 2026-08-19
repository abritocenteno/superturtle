/**
 * Shared type contracts for the Schildpad core.
 *
 * The core is deliberately platform-agnostic: it knows nothing about the DOM,
 * Canvas, Skia, or React. Platforms interact with it through three seams:
 *   - Surface: where drawing goes (Canvas2D on web, Skia on mobile)
 *   - Host:    side-channel back to the UI (print output, current line, pen change)
 *   - Clock:   how the driver schedules frames (rAF on web, Skia/Reanimated on mobile)
 *
 * Coordinates are LOGICAL: origin at the centre of the sheet, x right, y UP
 * (the Logo convention). Each Surface maps logical -> device pixels itself.
 */

export type TokenType =
  | 'num' | 'word' | 'var' | 'quote' | 'op'
  | '[' | ']' | '(' | ')';

export interface Token {
  t: TokenType;
  v: string | number;
  line: number;
}

/** A runtime value flowing through the interpreter. */
export type Value = number | string | boolean | LogoList;

/** A bracketed [ ... ] block, captured unevaluated (for repeat/if/while bodies). */
export interface LogoList {
  list: Token[];
}

/** A line to be drawn, in logical coordinates (origin centre, y up). */
export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

/** The full, serialisable state of a turtle. */
export interface TurtleState {
  x: number;
  y: number;
  heading: number;   // degrees, 0 = up/north, clockwise positive
  pen: boolean;
  visible: boolean;
  color: string;     // resolved hex
  width: number;
}

/**
 * A drawing surface. Web implements this over Canvas2D; mobile over Skia.
 * All coordinates passed in are logical (see file header).
 */
export interface Surface {
  readonly width: number;   // logical width  (e.g. 1200)
  readonly height: number;  // logical height (e.g. 900)

  /** Wipe the drawing. The background grid, if any, stays. */
  clearInk(): void;

  /** Draw one line segment on the ink layer. */
  drawSegment(seg: Segment): void;

  /** Redraw the sprite layer. Pass null to render nothing (hidden turtle). */
  renderTurtle(state: TurtleState | null): void;

  /** Toggle the background grid. Implementations repaint it themselves. */
  setGridVisible(on: boolean): void;
}

/** Side-channel from the interpreter back to the embedding UI. */
export interface Host {
  /** `print` / `schrijf` output. */
  print(text: string): void;
  /** Called before each command with its source line (for error mapping). */
  mark(line: number): void;
  /** Called whenever the active pen colour changes (to highlight the palette). */
  penChanged(color: string): void;
}

/** Injected scheduling primitives so the driver is platform-neutral. */
export interface Clock {
  now(): number;
  schedule(cb: () => void): void;
}

/** Locale identifier for messages and content. */
export type Lang = 'nl' | 'en';
