# Architecture

The guiding idea: **the language engine is platform-agnostic; only drawing is
platform-specific.** Everything below follows from keeping that line clean.

## The three seams

`packages/core` never imports a browser, React, or Skia API. It talks to the
outside world through three small injected interfaces (all in
`core/src/types.ts`):

### `Surface` — where drawing goes
```ts
interface Surface {
  readonly width: number;   // logical units, e.g. 1200
  readonly height: number;  // e.g. 900
  clearInk(): void;                                  // wipe + redraw grid
  drawSegment(seg: Segment): void;                   // one line, logical coords
  renderTurtle(state: TurtleState | null): void;     // redraw sprite (null = hide)
  setGridVisible(on: boolean): void;
}
```
`Segment` and all coordinates are **logical**: origin at the centre of the
sheet, x to the right, y **up** (the Logo convention). Each Surface maps logical
→ device pixels itself.

- Web: `apps/web/src/canvas-surface.ts` — immediate-mode Canvas2D. `drawSegment`
  strokes a line right away; two stacked canvases separate the ink layer from
  the per-frame turtle sprite.
- Mobile: `apps/mobile/src/skia-surface.ts` — Skia renders declaratively, so the
  Surface **retains** segments and notifies a subscribed `<Canvas>` to
  re-render. Same interface, opposite drawing model.

### `Host` — side-channel to the UI
```ts
interface Host {
  print(text: string): void;      // `schrijf` / `print` output
  mark(line: number): void;       // current source line (for error highlight)
  penChanged(color: string): void;
}
```

### `Clock` — how the driver schedules frames
```ts
interface Clock { now(): number; schedule(cb: () => void): void; }
```
Web injects `performance.now` + `requestAnimationFrame`; mobile injects RN's
global `requestAnimationFrame` (or a Reanimated frame callback). This is the
only reason the animation loop needs to know anything about the platform.

## Data flow of one run

```
source text
   │  tokenize()                      core/src/tokenizer.ts
   ▼
tokens ──► extractProcedures()        core/src/interpreter.ts
   │         splits `to…end` blocks from the main program
   ▼
createInterpreter(turtle, host).run(src)  → a generator
   │  the interpreter walks tokens, evaluates expressions, calls primitives
   │  primitives mutate the Turtle; the Turtle emits Segments to the Surface
   ▼
createDriver(iter, turtle, surface, clock)   core/src/driver.ts
   │  pulls generator values frame by frame:
   │    'draw'      → a segment was drawn; if animating, paint + yield a frame
   │    'tick'      → loop boundary; keeps instant runs cancellable
   │    { wait:n }  → pause n ms (the `wacht`/`wait` command)
   ▼
Surface.drawSegment / renderTurtle → pixels
```

The **generator** is what makes animation and cancellation clean: execution
suspends between turtle steps, so the driver decides pacing and can stop
mid-run without threads or flags reaching into the interpreter. A per-frame time
budget (default 12 ms) keeps max-speed runs from blocking the UI thread on huge
drawings.

## Why a tree-walking interpreter (not a compiler / AST)

Logo's grammar is tiny and its semantics are dynamic (dynamically-scoped
variables, runtime-defined procedures). A direct token-stream evaluator stays
short and keeps source line numbers close at hand, which is what makes the
child-friendly error messages possible. Performance is a non-issue at the scale
of a classroom drawing. If a future feature ever needs a real AST (e.g. a
step-debugger that highlights sub-expressions), the tokenizer output is the
natural place to grow one.

## Scoping model

Classic Logo **dynamic scoping**. `make` / `maak` walks the scope stack from the
top and writes to the nearest frame that already binds the name, else to
globals. A procedure call pushes a frame holding its parameters; `output` /
`geefterug` and `stop` unwind via thrown signals (`OutputSignal`, `StopSignal`)
caught at the procedure boundary. Recursion depth is capped (240 frames) to turn
runaway recursion into a friendly error instead of a stack overflow.

## Package boundaries

- `@schildpad/core` — engine. Zero deps, DOM-free. Exports the interpreter,
  turtle, driver, error/formatting utilities, alias & colour tables, and all
  types. This is the contract every app builds on.
- `@schildpad/content` — starter examples and command chips, per language. Pure
  data; depends only on core's *types*.
- `@schildpad/web` — the reference app and the thing Vercel serves.
- `@schildpad/mobile` — the Expo app; re-implements only the glue layer
  (`App.tsx`) and the Skia `Surface`.

When you add a language feature, it lands in `core` once and both apps get it
for free. That is the entire point of the layout.
