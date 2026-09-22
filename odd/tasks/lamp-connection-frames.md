# Lamp Connection Frames

Created: 2026-09-22T13:10:00Z
Status: completed

## Goal
Fix lamp assembly by making Mount → Transition → Shade connect through explicit ConnectionFrames instead of implicit offsets.

## Constraints
- No hardcoded offsets for Generic Threaded Mount or Wave Lamp.
- Global model convention: center at X=0/Y=0, vertical axis +Z.
- Mount output radius must match Transition input radius within tolerance.
- Transition output radius must match Shade input radius within tolerance.
- Invalid frame mismatches fail validation and do not silently generate gaps.
- Debug Connections and Exploded View are viewport-only; they must not change exportable mesh coordinates.
- No commits unless explicitly requested by the user.

## Tasks
- [x] Add generic ConnectionFrame/component assembly primitives.
- [x] Update Generic Threaded Mount to expose frames derived from generated geometry.
- [x] Update Transition generation to receive inputFrame and return outputFrame.
- [x] Update Wave Lamp shade generation to receive inputFrame and generate global Z from it.
- [x] Route procedural assembly through a generic assembler with frame validation.
- [x] Add viewport-only Debug Connections and Exploded View toggles.
- [x] Add focused tests and run verification.

## Evidence
- `npm test` — passed; deformer and lamp assembly tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed; Vite emitted the existing large-chunk warning and a replicad browser externalization warning.
- No commit created per user instruction.
