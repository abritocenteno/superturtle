# The layout

The app is one layout at every width: **paper on top, program underneath**,
with a draggable divider between them. This document is why, and it doubles as
the spec for the React Native port — the web version exists so the design can
be tried on a real phone before anyone writes Skia code against it.

## The constraint

A 390×844 phone gives ~763pt under the browser chrome. Opening the keyboard
takes roughly 300pt of that. So the honest budget is:

| | keyboard closed | keyboard open |
| --- | --- | --- |
| available | ~763pt | ~460pt |

The paper fills whatever width it is given, so its height is purely what the
split hands it. An editor worth typing in needs at least six or seven lines,
~200pt. Both fit with the keyboard closed and neither fits comfortably with it
open — which is the whole design problem.

## The answer: one split, and the child moves it

An earlier version solved the budget with two modes and a toggle. It tested
badly: the thing you are working on kept moving out from under you, and you
had to know which mode you were in before you knew what a tap would do.

So instead both panes are always on screen and the child decides the ratio.
`--split` is the paper's height; the grip between the panes drags it, and
nothing else in the app needs to know its value. Wanting a bigger picture and
wanting more code are the same gesture, in opposite directions.

- **Default** 58% paper on desktop, 46% on a phone. A phone's paper is limited
  by width, not height, so it needs a smaller share before the extra height is
  just padding.
- **Floors** 220px paper, 200px code (`MIN_PAPER` / `MIN_CODE` in `app.ts`).
  A sheet dragged down to a sliver reads as broken rather than as small, and
  the code pane still has to fit console, key row and chips.
- **Keyboard** arrows on the focused grip move it 16px (64 with shift),
  `Home` or `Escape` restores the default. Drag-only would put the split out
  of reach of a keyboard. Double-click resets too.
- **Two axes on desktop.** A second grip (`--chips`, default 50%, floors
  132/360) sets how much width the chip column takes from the editor. Half and
  half is the honest default: the chips are a menu you read while writing, not
  a sidebar you glance at. It is hidden below 720px, where the chips are a
  strip again and there is no width to trade.

## Details that are load-bearing

- **The paper is full-bleed and the logical space follows it.** The sheet takes
  the whole width of its pane; `CanvasSurface.fit()` then keeps the logical
  *height* fixed at 900 and derives the logical width from the box's aspect
  ratio. So `vooruit 100` covers the same fraction of the paper's height on
  every screen, and a wider window means more room to draw sideways rather than
  a stretched drawing. An earlier version boxed the sheet to 4:3 with container
  queries; full width won because the paper is the point of the app.
- A resize is a **centred blit**: both the old and the new logical space have
  their origin in the middle, so the ink moves by `(newW - oldW) / 2` with no
  scaling and nothing is lost. `fitSheet()` in `app.ts` is rAF-throttled — a
  drag produces one canvas resize per frame at most.
- Three stacked canvases (`#grid`, `#ink`, `#turtle`). The grid is its own
  layer so a resize can blit the ink cleanly, and so the `raster` toggle
  repaints only itself — it used to wipe the drawing.
- The logical width is capped at 4096 (three backing stores that wide are
  already ~44 MB). Past the cap the sheet letterboxes via `object-fit:contain`
  rather than distorting; you only reach it by dragging the split to its floor
  on a wide screen.
- `interactive-widget=resizes-content` in the viewport meta. Without it the
  keyboard covers the layout instead of shrinking it, and everything pinned
  to the bottom of the screen — key row, chips — ends up underneath it.
- `100dvh`, not `100vh`, for the same reason.
- The editor's font-size is **15px** on narrow. iOS zooms the page when you
  focus an input smaller than 16px; 15px is the largest size that still fits
  a useful line width, and the zoom threshold is what forced the choice —
  revisit it only with a device in hand.
- The key row (`[ ] : "` + backspace + run) exists because every Logo program
  needs brackets and colons and both are two taps deep on a phone keyboard.
  The buttons call `preventDefault()` on mousedown so the caret and the
  keyboard survive the tap.
- Chips insert a snippet **and** place the caret where the child has to type
  next (`Editor.insertSnippet`). On desktop they are a column *beside* the
  editor, not a strip under it: the code pane is already sharing its height
  with the paper, and three rows of chips at the bottom left no editor once the
  split moved. On a phone there is no width for a second column, so there they
  go back to being one horizontally scrolling strip and drop their description
  text.
- The key row's ▶ is the run button on narrow — the top bar's Teken/Stop pair
  is hidden there — and it doubles as stop, turning amber with a ■ while a
  program runs. One run button per screen: an earlier version also had one in
  the status row and the pair read as two different things.
- **wissen / clear** empties the editor, and pressing it again on an editor
  still empty puts the text back (`Editor.clear` / `restore`). It clears
  through `execCommand` so Ctrl Z works too, but a phone has no undo and the
  button is one tap from the brackets a child uses constantly — losing the
  whole program to a mis-tap had to be impossible. It sits in the program
  header on desktop and in the key row on a phone, where that header is hidden;
  a word rather than a symbol, because any glyph next to backspace reads as
  another backspace.
- The console is capped at exactly three lines (12px × 1.5 + padding). A
  clipped half-line under an error message reads as breakage.
- `touch-action:none` on the grip, and pointer capture on drag: without either,
  a downward drag scrolls the page instead of moving the split.
- `overflow:hidden` **and** `contain:paint` on `.code`. The highlighter and the
  gutter are composited layers (`will-change:transform`); while the split is
  being dragged, clipping by the ancestor alone let them paint over the console
  and the chips for a frame.

## Porting notes for `apps/mobile`

Everything above is layout and interaction, not language behaviour — the
interpreter, driver and content packages are already shared. What the RN app
has to reproduce:

1. the split container with a draggable grip (`PanResponder` or
   `react-native-gesture-handler` replaces pointer capture), same floors and
   same defaults — the horizontal one is desktop-only and can be skipped;
2. the key row and chip strip above the keyboard — RN's
   `KeyboardAvoidingView` replaces `interactive-widget`;
3. the key row's run button doubling as stop, amber while busy.

The turtle sprite and the grid are still Canvas2D-only and have to be drawn
with Skia paths; that is tracked separately in [`roadmap.md`](roadmap.md).
`SkiaSurface` also still hard-codes a 1200×900 logical space — porting the
full-bleed sheet means giving it the same fixed-height/derived-width `fit()`,
which is the one place where the two surfaces have drifted apart.
