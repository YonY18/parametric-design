# Attachment Interface

## Goal
Redesign the Wave Lamp mount/shade/retaining-ring connection so one canonical attachment interface drives all compatible mechanical dimensions, keeps the mechanical zone undeformed, and separates mount, attachment, transition, and decorative shade regions.

## Tasks
- [x] Introduce one `AttachmentInterface` mapping from user-facing mechanical parameters to mount, ring, and shade-neck dimensions.
- [x] Recompose the mounted geometry so the shade flange is trapped between mount seat and retaining-ring pressure face, with the decorative shade starting after the neck and transition.
- [x] Add regression checks for canonical thread derivation, flange capture, and undeformed mechanical/decorative boundary.
- [x] Run focused tests and type checks.

## Evidence
- `node --experimental-strip-types --loader ./tests/ts-extension-loader.mjs tests/lamp-mounts.test.ts` — passed.
- `npx tsc --noEmit -p tsconfig.app.json` — passed.
- `npx eslint src/geometry/attachmentInterface.ts src/generators/wave-lamp.ts src/cad/procedural-backend.ts tests/lamp-mounts.test.ts` — passed.
- `lens_diagnostics` on changed paths — 0 errors reported; 1 file confirmed clean, 3 inconclusive due push-only/silent-on-clean server behavior.

## Notes
- `AttachmentInterface` is the source of truth for nominal thread, pitch, length, clearance, seat, flange, neck, and ring wall/height.
- Mount male thread keeps zero clearance so it remains nominal; retaining-ring female thread gets the interface clearance.
- Work-unit commits are deferred because this session policy requires explicit user authorization before commits.
