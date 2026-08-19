/**
 * @schildpad/core — the platform-agnostic turtle-graphics engine.
 *
 * Nothing here touches the DOM, Canvas, Skia, or React. A platform supplies a
 * Surface, a Host, and a Clock; the core parses, interprets, and drives.
 *
 * Typical wiring (see apps/web for a full example):
 *
 *   const turtle = new Turtle(surface);
 *   const interp = createInterpreter(turtle, host);
 *   turtle.reset();
 *   surface.clearInk();
 *   turtle.stepLen = SPEEDS[speedIndex];
 *   const handle = createDriver(interp.run(source), turtle, surface, clock, {
 *     onDone:  () => {},
 *     onError: (e) => host.print(formatError(e, lang)),
 *   });
 *   // handle.stop() to cancel.
 */

export { tokenize } from './tokenizer.ts';
export { createInterpreter } from './interpreter.ts';
export type { Interpreter } from './interpreter.ts';
export { Turtle } from './turtle.ts';
export { createDriver, SPEEDS } from './driver.ts';
export type { DriverHandle, DriverCallbacks } from './driver.ts';
export { LogoError, StopSignal, OutputSignal } from './errors.ts';
export type { ErrorKey } from './errors.ts';
export { MESSAGES, formatError } from './messages.ts';
export type { Messages } from './messages.ts';
export {
  ALIAS, ARITY, LIST_ARGS, REPORTERS, TO_WORDS, END_WORDS, KEY_CTL, resolve,
} from './aliases.ts';
export { COLORS, PEN_ORDER, PEN_EN, resolveColor } from './colors.ts';
export type {
  Token, TokenType, Value, LogoList, Segment,
  TurtleState, Surface, Host, Clock, Lang,
} from './types.ts';
