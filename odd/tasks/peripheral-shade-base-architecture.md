# Peripheral Shade/Base Architecture

## Goal
Replace Wave Lamp's central-thread style mechanical architecture with a peripheral shade seat, circular bottom collar, independent central lamp-holder pedestal/reference, and local cable passage.

## Constraints
- Do not use ThreadedHub/ThreadedHole/RetainingRing as the Wave Lamp shade/base connection.
- Do not connect Decorative Shade to the central pedestal.
- Keep decorative shade body unchanged except the lower BottomAdaptation/BottomCollar zone.
- Keep the first implementation small: Recessed Seat and Raised Lip only.
- No new complex retention mechanisms beyond a simple configurable press/slide fit marker.

## Tasks
- [x] Define minimal peripheral base, shade seat, pedestal, holder reference, and cable passage geometry for Wave Lamp.
- [x] Add BottomAdaptation/BottomCollar support while preserving decorative body above the adaptation zone.
- [x] Recompose Wave Lamp assembly into Base, Shade, and LampHolderReference with exploded-view-friendly parts.
- [x] Simplify Wave Lamp UI parameters and stop exposing ThreadedHole/ThreadSpec/RetainingRing in this flow.
- [x] Replace lamp mechanical tests with the new architecture invariants.
- [x] Run tests, lint, typecheck, and build; capture evidence.

## Evidence
- Added `src/geometry/lampBase.ts` with a solid plinth, bottom floor, peripheral seat modes, independent pedestal/holder reference, and local cable passage.
- Wave Lamp shade now uses a circular bottom collar and smootherstep lower adaptation; decorative geometry above the adaptation remains isolated from base/holder mechanics.
- Procedural assembly now contains `base`, `decorative-shade`, and `lamp-holder-reference`; the holder reference is marked visual-only.
- Removed Wave Lamp mount/thread parameters and replaced the old lamp test with peripheral-seat, collar, fit, cable, floor, isolation, and finite-mesh invariants.
- `node --experimental-strip-types --loader ./tests/ts-extension-loader.mjs tests/lamp-mounts.test.ts` passed.
- `npm test` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed; Vite emitted only the existing large-chunk warning.
