# Hidden Mechanical Core

## Goal
Redesign the Wave Lamp attachment zone so the mechanical thread, retaining interface, flange, and seat form a compact hidden mechanical core while the visible lamp reads as Base → small collar → smooth transition → decorative body.

## Tasks
- [x] Derive compact mechanical core dimensions: circular hidden flange, circular neck, compact retaining ring, and separate mechanical/decorative radii.
- [x] Generate mounted shade geometry as Circular Flange → Circular Neck → Smooth Transition → Decorative Body with smootherstep deformation ramp.
- [x] Add debug/material part metadata and regression checks proving the mechanical zone stays circular and undeformed.
- [x] Run tests, lint, typecheck, build, and record validation evidence.

## Evidence
- `node --experimental-strip-types --loader ./tests/ts-extension-loader.mjs tests/lamp-mounts.test.ts` — passed; maxBoundaryError=0.0000033221556696914298.
- `npm test` — passed (deformer and lamp mount suites).
- `npx eslint src/geometry/attachmentInterface.ts src/geometry/waveLamp.ts src/generators/wave-lamp.ts src/cad/procedural-backend.ts tests/lamp-mounts.test.ts` — passed.
- `npx tsc --noEmit -p tsconfig.app.json` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed with Vite's existing large-chunk warning.
- Regression coverage verifies compact ring derivation, circular flange/neck rings, zero deformation at the blend start, smootherstep ramping, and a non-flattened first decorative ring.
- No commit created per session policy.

## Notes
- Commits are deferred because this session policy requires explicit user authorization before commits.
