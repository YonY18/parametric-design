# Wave Lamp Thread + Decorative Redesign

## Goal
Restore a real reusable mechanical thread system and redesign the decorative Wave Lamp generator without mixing mechanical thread geometry with decorative math.

## Constraints
- `ThreadSpec` is the only source of truth for pitch, nominal diameter, length, depth, clearance, handedness, and profile type.
- ThreadedHub derives male thread geometry from `ThreadSpec`.
- RetainingRing derives compatible female thread geometry from the same `ThreadSpec` plus clearance.
- Decorative silhouette, surface pattern, twist, and wall generation remain separate from the mechanical core.
- Mechanical thread parameters must not change exterior shade silhouette/pattern/twist.
- Shade dimensions must not change thread diameter/pitch/fit.
- Keep CAD generation in the existing worker path; export geometry must contain printable thread geometry.
- No new generator families.
- Do not commit unless the user explicitly authorizes it in this session.

## Tasks

- [x] 1. Add ThreadSpec-centered mechanical thread geometry.
  - Evidence: male/female same pitch and handedness; derived clearance; valid thread length and turns; finite meshes; boolean/geometry validity checks.
  - Commit: deferred; user has not authorized commits.

- [x] 2. Refactor Wave Lamp decorative geometry into silhouette, surface pattern, twist, and wall stages.
  - Evidence: amplitude zero equals base silhouette; twist zero preserves radii; fades produce circular ends; no negative radii.
  - Commit: deferred; user has not authorized commits.

- [x] 3. Update Wave Lamp UI schema, defaults, decorative presets, randomize, and debug toggles.
  - Evidence: canonical decorative controls, six requested presets, silhouette/pattern options, and requested defaults validate and generate valid meshes; randomize preserves wall thickness and mechanical thread/support parameters.
  - Commit: deferred; user has not authorized commits.

- [x] 4. Run full verification.
  - Evidence: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` passed.
  - Commit: deferred; user has not authorized commits.

## Evidence
- `src/cad/procedural-backend.ts` — mounted generation passes the complete ThreadSpec, including length, depth, handedness, and profile type, to the mechanical core.
- `npm test` — passed; deformers, canonical ThreadSpec, and mounted Wave Lamp rescue architecture tests all pass.
- `node --experimental-strip-types --loader ./tests/ts-extension-loader.mjs tests/thread-spec.test.ts` — passed; canonical ThreadSpec drives compatible male/female helical meshes.
- `node --experimental-strip-types --loader ./tests/ts-extension-loader.mjs tests/lamp-mounts.test.ts` — passed; canonical decorative schema, requested presets/defaults, randomization, circular fades, silhouette, twist, finite meshes, and mechanical independence are covered.

## Notes
- Work units A and B are independent; implement A first, then B.
- Keep existing assembly part IDs unless a test-backed API change is unavoidable.
- Full repository verification passed: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
