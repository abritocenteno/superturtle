# Roadmap

Ordered by "what unblocks the most next." Each phase is shippable on its own.

## Phase 0 — Land the monorepo (mostly done)

The scaffold you're reading is Phase 0. Remaining bits:

- [ ] `pnpm install` and confirm `pnpm dev:web` serves the reference app.
- [ ] `pnpm test` green (the core suite ships passing; verify it runs in your
      environment).
- [ ] First Vercel deploy of `apps/web` (set Root Directory or use the included
      `vercel.json`).
- [ ] First Expo run of `apps/mobile` on an Android device/emulator — confirm the
      shared core animates through Skia. It will draw the recursive tree.

## Phase 1 — Mobile feature parity

The web app is the reference; bring mobile up to it.

- [ ] Port the turtle sprite from `apps/web/src/canvas-surface.ts`
      (`renderTurtle`) into the Skia `TurtleSprite` component. Right now it's a
      placeholder dot.
- [ ] Draw the background grid in Skia (mirror `CanvasSurface.paintGrid`) on
      its own layer, and give `SkiaSurface` the web's `fit()`: fixed logical
      height, width from the box's aspect ratio.
- [ ] Port the layout from the web app: the draggable paper/program split
      with its floors and defaults, the full-bleed sheet, the key row with its
      run/stop button, and the chip strip. It is specified and already
      clickable at <720px on web — [`layout.md`](layout.md).
- [ ] A mobile code editor: a monospace input with the command chips from
      `@schildpad/content` as tap-to-insert buttons (typing on a phone is the
      friction point — chips matter more here than on web).
- [ ] Pen palette, examples picker, speed control, run/stop, NL/EN toggle.
- [ ] Batch `drawSegment` notifications to one per driver frame for large
      drawings (see the note in `skia-surface.ts`).
- [ ] Share the logical→device `px`/`py` helpers between the two surfaces
      instead of duplicating them.

## Phase 2 — Multi-turtle

The most-requested SuperLogo feature this doesn't yet have. Kids loved naming
turtles and driving them together.

- [ ] Generalise: the interpreter holds a set of turtles with an "active" one;
      `nieuwe schildpad` / `newturtle`, `kies` / `tell N` to switch, and let the
      existing movement commands drive whichever is active.
- [ ] The driver renders **all** turtle sprites each frame, not one. `Surface`
      grows a `renderTurtles(states[])` (or keep `renderTurtle` and let the app
      diff).
- [ ] Decide whether each turtle owns its pen/colour state (yes) and whether
      programs can address turtles by name in expressions.
- [ ] Keep single-turtle programs working unchanged — the default is one turtle
      named the same as today.

## Phase 3 — Making it stick in a classroom

- [ ] **Stamp** (`stempel` / `stamp`): drop a copy of the turtle shape onto the
      ink layer. Cheap, delightful, great for patterns.
- [ ] **Challenge cards / ghost target**: show a faint target drawing; the kid
      writes code to match it. Store cards as `{ name, targetProgram, hint }` in
      `@schildpad/content` and render the target by running its program to a
      low-opacity layer. This is the single highest-leverage learning feature.
- [ ] **Save / load** programs. On web: localStorage plus file download/upload.
      On mobile: the filesystem. A shared serialisation format (just the source
      text plus a name) keeps them interchangeable.
- [ ] **Share a drawing**: PNG export exists on web (`CanvasSurface.toPNG`); add
      the Skia equivalent (`makeImageSnapshot`) and a native share sheet.

## Phase 4 — Language depth (only if wanted)

Keep the language small on purpose; add only what pulls its weight.

- [ ] Lists as first-class values (`fput`, `first`, `item`) — opens up a lot but
      raises the conceptual bar; gate behind an "advanced" toggle.
- [ ] `arc` / `boog` and `circle` / `cirkel` as primitives (kids reach for these
      early; today they approximate with `herhaal`).
- [ ] `fill` / `vul` a closed shape. Non-trivial on both surfaces — scope
      carefully.
- [ ] A step/trace mode that highlights the running line (the interpreter
      already calls `host.mark(line)` every command, so the hook exists).

## Explicitly out of scope

- **Block-based editing.** Typing real commands is the pedagogical point; blocks
  would undercut it.
- **A cloud account system.** Local save/load and PNG/share cover the classroom
  need without the privacy and ops burden of storing children's data.
- **Turning the core into a general Logo.** Fidelity to *this* teaching dialect
  beats completeness. Add primitives when a lesson needs them, not for parity
  with historical Logo.

## Notes for whoever builds this

- Every language change is one change in `core` plus its NL/EN pair in
  `content`/`messages`. Resist per-app forks.
- The prototype in `prototype/schildpad.html` is the behavioural oracle. When in
  doubt about how a command should feel, run it there.
- Add a test in `packages/core/test` for every new primitive or parsing rule.
  The suite is fast and headless; there's no excuse not to.
