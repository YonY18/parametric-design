# Lamp Shade Interface Ring

Created: 2026-09-22T13:35:00Z
Status: completed

## Goal
Make the shade physically connect to the mount/transition instead of only resting visually on the threaded base.

## Root cause
Wave Lamp receives a `shadeInputFrame`, but the first shade row still runs through decorative deformers. That means the actual first ring can become wavy/scaled instead of matching `inputFrame.radius` exactly.

## Constraints
- No hardcoded offsets.
- No hidden filler/scaling.
- The shade input ring is mechanical interface geometry and must stay circular at `inputFrame.radius` and `inputFrame.position.z`.
- Decorative deformation starts above the interface.
- Preserve current default standalone behavior as much as practical.
- No commit unless explicitly requested.

## Tasks
- [x] Pin the shade first ring to its input frame radius/Z before decorative deformation.
- [x] Add tests proving the connected shade first ring is circular and matches the frame.
- [x] Expose the Generic Threaded Mount output frame at the exterior collar/body interface while keeping the thread radius mechanical.
- [x] Default mounted transition validation and tests to the collar radius.
- [x] Run required verification.

## Evidence
- `src/geometry/waveLamp.ts`: row 0 now bypasses decorative deformers, preserving the input frame radius and Z while rows above retain the normalized-height pipeline.
- `tests/lamp-mounts.test.ts`: mounted Wave Lamp shade outer interface columns are asserted to be circular and aligned to the connected input frame radius/Z.
- `src/geometry/mounts.ts`: Generic Threaded Mount output frame now uses `bodyStartRadius` at `bodyStartHeight`; `connectionRadius` remains the threaded connector radius.
- `src/generators/wave-lamp.ts`: mounted transition start-radius validation now compares against `mountOuterDiameter / 2`.
- `npm test`: passed (`Deformer tests passed`; `Lamp mount tests passed`).
- `npm run typecheck`: passed.
