# Mechanical Retaining Ring Attachment

Created: 2026-09-22T11:10:00Z
Status: completed

## Goal
Add an explicit mechanical lamp attachment chain: Mount → MountSeat → ShadeNeck/Flange → RetainingRing → Transition → DecorativeShade.

## Constraints
- Keep conceptual separation between mount, transition, and shade, while adding explicit mechanical interface components.
- Use external thread on mount and internal thread on retaining ring.
- Do not hide collisions by silently deforming geometry.
- Keep UI schema-driven; avoid hardcoded panel controls.
- Retaining ring and mount remain independent parts; shade neck and decorative shade may be one generated shade part or clearly separated parts.
- Do not implement snap fits, bayonets, clips, inserts, electrical analysis, persistent mount library, or material-specific tolerance automation.
- No commit unless explicitly requested.

## Tasks
- [x] Extend Generic Threaded Mount with explicit support lip parameters and generated seat metadata.
- [x] Add reusable retaining ring and shade neck/flange geometry with assembly validation.
- [x] Compose Wave Lamp as Mount → ShadeNeck → RetainingRing → Transition → DecorativeShade with debug/profile markers.
- [x] Add schema-driven Attachment / Mechanical Interface controls and defaults.
- [x] Add viewport toggles/metadata for mechanical parts, retaining ring visibility, exploded inspection, and debug planes.
- [x] Add tests for mechanical capture, thread compatibility, decorative start, numerical safety, and exploded coordinate invariance.
- [x] Run npm test, lint, typecheck, and build.

## Route
- Exploration delegated to `gentle-ai-explore` because understanding touched more than four files.
- Implementation must be delegated to `gentle-ai-worker` because the bounded write touches multiple non-trivial files.

## Evidence
- `src/geometry/mounts.ts` now generates a separate support-lip mesh/frame and retains the mount external thread.
- `src/geometry/retainingRing.ts` and `src/geometry/shadeNeck.ts` provide reusable internal-thread, pressure-face, flange, and neck definitions.
- `src/cad/procedural-backend.ts` assembles explicit `mount`, `mount-seat`, `shade-neck`, `retaining-ring`, optional `transition`, and `shade` parts with plane markers.
- `src/generators/wave-lamp.ts` validates seat fit, flange closure, thread compatibility/engagement, clearances, cable/neck fit, and finite dimensions; UI parameters are schema-driven under Attachment and Mechanical Interface.
- `src/viewer/Viewport.tsx` provides mechanical-part, retaining-ring, exploded, and connection toggles without mutating part mesh coordinates.
- `tests/lamp-mounts.test.ts` covers capture metadata, internal threading, flange/neck planes, wave/twist assembly, invalid compatibility, finite geometry, and exploded coordinate invariance.
- `npm test`: passed (deformer and lamp mount tests; maxBoundaryError=0.0000017399147988209352).
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite emitted the existing large-chunk warning and node:module externalization warning.
- No commit created, per task constraint.
