# Wave Lamp RimInterface Stabilization

## Goal
Stabilize Decorative Shade + RimInterface only. Temporarily stop Mount, ThreadedHub, RetainingRing, InternalSupport, GenericBase, and other base work from participating in Wave Lamp generation.

## Constraints
- Wave Lamp visual assembly contains only DecorativeShade + RimInterface.
- Decorative shade main parameters stay minimal: height, bottomDiameter, topDiameter, wallThickness, waves, amplitude, twist.
- RimInterface parameters are independent: diameter, height, thickness, lipDepth, clearance.
- No decorative deformer may affect RimInterface.
- Decorative amplitude fades to zero before the rim using smootherstep.
- The shade mounting ring is circular and connects cleanly to the rim.
- Changing waves, amplitude, or twist must not alter rim dimensions or mesh.
- Do not advance base work until Wave Lamp alone + RimInterface are clean.

## Tasks
- [x] Explore existing Wave Lamp composition and rim coupling.
- [x] Update generator parameters/defaults/validation to the reduced shade + independent rim contract.
- [x] Update procedural composition to emit only DecorativeShade + RimInterface.
- [x] Ensure decorative profile fades to a circular mounting end before the rim.
- [x] Add regression tests for circular/identical RimInterface under deformer changes and no base/mount parts.
- [x] Run tests, lint, typecheck, and build.

## Evidence
- Exploration: current generation composes GenericBase -> RimInterface -> DecorativeShade, with optional mount feature; tests currently assert base/thread behavior and need replacement.
- Implementation: generator now exposes the reduced shade contract plus independent rim parameters; Wave Lamp assembly emits only `rim-interface` and `decorative-shade`.
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` pass. Build warns about externalized `node:module` and large chunks.
