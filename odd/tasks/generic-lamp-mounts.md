# Generic Lamp Mounts

Created: 2026-09-22T12:37:16Z
Status: completed

## Goal
Separate lamp composition into Mount → Transition → Parametric Shade, keeping Wave Lamp unaware of mount internals.

## Constraints
- Do not embed thread logic inside Wave Lamp.
- UI controls for Generic Threaded Mount come from parameter schema, not panel hardcoding.
- Invalid settings must not generate broken geometry; keep the last valid mesh in the store.
- Mount presets are in-memory only and are initial geometry presets, not electrical standards.
- No commits unless explicitly requested by the user.

## Tasks
- [x] Add generic parameter select support for schema-driven UI.
- [x] Add reusable mount, mount profile, transition, and thread feature core modules.
- [x] Integrate Generic Threaded Mount and transition parameters into Wave Lamp defaults/schema/validation.
- [x] Update Wave Lamp mesh generation to compose Mount → Transition → Shade from profiles.
- [x] Add focused tests and run lint/typecheck/test.

## Evidence
- `npm test` — passed with `tests/ts-extension-loader.mjs`; Node emitted its existing experimental loader warning.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- No commit created per user instruction.
