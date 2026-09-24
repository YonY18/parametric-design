# Rescue Lamp Core

## Goal
Simplify the Wave Lamp architecture into three explicit layers: Decorative Shade, Mechanical Core, and Assembly. Do not add features; stabilize the existing model with fewer user-facing parameters and derived mechanical dimensions.

## Tasks
- [x] Stabilize Decorative Shade with a small public parameter set and clear validation.
- [x] Add an isolated Mechanical Core derivation layer for ThreadedHub, RetainingRing, and annular InternalSupport.
- [x] Rebuild Assembly so the support connects internally to the shade inner wall without deforming the exterior shade profile or circular mechanical parts.
- [x] Simplify the normal UI parameter schema and keep debug inspection controls simple.
- [x] Update tests for shade, mechanical core, and assembly invariants.
- [x] Run tests, lint, typecheck, and build.

## Evidence
- Branch: `rescue-refactor-lamp-core`.
- Validation: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` passed.
- Work-unit commits are deferred because this session policy requires explicit user authorization before commits.

## Notes
- No new base types, no new deformers, no advanced mode in this pass.
- Bulge and vertical wave remain internal defaults only unless proven stable enough to expose later.
