# @schildpad/mobile

Expo app (Android-first) that renders the shared `@schildpad/core` engine
through Skia. Today it runs and draws an example so you can confirm the core
animates on-device; the UI is a starting point, not finished.

- `src/skia-surface.ts` — implements the core `Surface` over Skia (retained
  draw ops + a subscribe hook). This is the one real platform difference.
- `src/App.tsx` — minimal screen: a sheet, a run button, and the shared driver.

What to build next is in [`../../docs/roadmap.md`](../../docs/roadmap.md),
Phase 1. The core, grammar, and content are all shared — you're only writing
native UI and the Skia rendering here.

Run: `pnpm dev:mobile` from the repo root (needs the Expo toolchain).
