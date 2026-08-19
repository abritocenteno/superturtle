# Schildpad 🐢

A modern turtle-graphics programming environment for teaching kids to code, in
**Dutch and English at the same time**. A spiritual successor to the 1990s Dutch
educational program *SuperLogo* (Bruna Informatica / Addo Stuur's book
*Programmeren voor kinderen met SuperLogo*, 1994), rebuilt for the browser and
for Android.

Type `vooruit 100 rechts 90` (or `forward 100 right 90`) and a turtle draws it.
Kids write real text commands — the point is programming, not dragging blocks.

---

## Why this shape

The hard, valuable part of a Logo environment is the **language engine**:
tokenizer, interpreter, turtle model, and an animation driver that can pause and
cancel cleanly. That engine is pure TypeScript with **zero runtime dependencies**
and is **identical on every platform**. Only one thing differs between web and
mobile: *where the lines get drawn*.

So the repo is a small monorepo with a shared core and two thin apps:

```
schildpad/
├── packages/
│   ├── core/        The engine. Zero deps. 51 tests. The crown jewel.
│   └── content/     Starter examples + command chips (NL/EN).
├── apps/
│   ├── web/         Vite + Canvas2D. Deploys to Vercel. The reference UI.
│   └── mobile/      Expo + Skia. Runs on Android. A documented starting point.
├── prototype/
│   └── schildpad.html   The original single-file prototype (works standalone).
└── docs/            architecture.md · grammar.md · roadmap.md
```

The seam that makes this work is the **`Surface`** interface in `core`. The
interpreter and driver never touch a canvas; they hand logical-coordinate line
segments to whatever `Surface` you inject. Web implements `Surface` over
Canvas2D; mobile implements the same interface over Skia. See
[`docs/architecture.md`](docs/architecture.md).

---

## Getting started

Requires **Node ≥ 20** and **pnpm 9** (`npm install -g pnpm`).

```bash
pnpm install

pnpm dev:web      # web app at http://localhost:5173
pnpm test         # run the core test suite
pnpm typecheck    # type-check every package
```

Mobile (Android), once you have the Expo toolchain:

```bash
pnpm dev:mobile   # Expo dev server; open in Expo Go or an emulator
```

The **prototype** needs no toolchain at all — open `prototype/schildpad.html`
directly in a browser. It's the fastest way to see the target behaviour and to
sanity-check language changes against a known-good implementation.

---

## Deploying

**Web → Vercel.** The repo is a monorepo, so point Vercel at `apps/web`:

- Set the project's **Root Directory** to `apps/web` in the Vercel dashboard, or
- rely on the included [`apps/web/vercel.json`](apps/web/vercel.json), which runs
  the build from the repo root (`pnpm build:web`) so the workspace packages
  resolve.

Vercel auto-detects Vite; output is `apps/web/dist`.

**Mobile → Expo.** Android builds go through EAS:

```bash
cd apps/mobile
eas build --platform android
```

`.npmrc` pins a **hoisted** pnpm layout (`node-linker=hoisted`) because Metro
can't resolve pnpm's default symlinked layout, and
[`apps/mobile/metro.config.js`](apps/mobile/metro.config.js) is monorepo-aware so
Metro watches the workspace root. Keep both if you stay on pnpm + Expo.

---

## The language in 30 seconds

Both languages are always live — `vooruit` and `forward` are the same command,
and a program may mix them. The UI language toggle only changes labels,
examples, and error wording. Full reference: [`docs/grammar.md`](docs/grammar.md).

```logo
naar ster :zijde
  herhaal 5 [ vooruit :zijde  rechts 144 ]
einde

wisscherm
penkleur "roze
ster 260
```

```logo
to tree :len
  if :len < 9 [ stop ]
  forward :len
  right 27   tree :len * 0.72
  left 54    tree :len * 0.72
  right 27   penup back :len pendown
end

clearscreen
tree 150
```

Supported: movement, pen control, `herhaal`/`repeat`, user procedures
(`naar…einde` / `to…end`) with parameters and recursion, variables (`maak`/`make`
+ `:name`), conditionals (`als`/`if`, `alsanders`/`ifelse`), `zolang`/`while`,
`stop`, `geefterug`/`output`, arithmetic with precedence and parentheses, and
reporter functions (`toeval`/`random`, `wortel`/`sqrt`, trig, position queries).

---

## What's done vs. what's next

**Done and tested** — the `core` package is a complete, faithful port of the
prototype interpreter into typed modules, with a 51-test suite (parsing,
procedures, recursion, expressions, control flow, errors, a Koch-snowflake depth
check, and end-to-end driver runs on a fake clock covering animation pacing,
`wacht`, the frame budget, cancellation and error reporting). The **web app** is a
working reference UI: paper on top, program underneath, with a draggable
divider between them and a phone layout below 720px (see
[`docs/layout.md`](docs/layout.md)), which doubles as the design prototype for
the native app. The **mobile app** runs and draws through Skia but
its UI is a stub.

**Next** — port that layout to `apps/mobile`, then multi-turtle support (the most
requested SuperLogo feature we don't yet have), a stamp command, and
challenge/"ghost target" cards. Phased plan in
[`docs/roadmap.md`](docs/roadmap.md).

---

## Repo conventions

- Core stays **dependency-free and DOM-free** — no `window`, no React, nothing
  platform-specific leaks in. If you need a platform capability, add it to the
  `Surface`, `Host`, or `Clock` interface instead.
- Both languages are peers. Anything added to one gets added to the other in the
  same change — commands (`aliases.ts`), examples and chips (`content`), and
  error wording (`messages.ts`).
- Error messages are for **children**: name the line, say what's wrong, suggest
  the fix. They carry i18n keys, never baked-in strings.
