# Wave Lamp

## Goal
Implement the first real procedural parametric model: a hollow, closed, printable Wave Lamp integrated with the existing generic generator, parameter, worker, and viewer architecture.

## Tasks
- [x] Add generator-owned schema, metadata, defaults, validation, reset, and randomization support.
- [x] Generate a closed manifold procedural Wave Lamp mesh in the worker with positions, indices, normals, and mesh integrity checks.
- [x] Preserve responsive regeneration with debounce, generation IDs, last-valid geometry, and validation errors.
- [x] Update the viewport and panels for geometry replacement, dimensions, reset, and randomize without generator-specific UI rules.
- [x] Document Wave Lamp generation and run lint, typecheck, and build.
- [x] Polish generic integer clamping and keep the nine-parameter inspector scrollable.

## Evidence
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite emitted only the existing large-chunk warning.
- Wave Lamp blocker follow-up: integer numeric metadata is typed generically, and procedural geometry now uses the requested tapered, waved, and twisted parameterization with radial wall-thickness subtraction.
- Correctness polish: integer parameters are rounded during clamping, and the parameter panel scrolls when nine Wave Lamp controls exceed the viewport.

## Notes
- No lamp holder, holes, Voronoi, patterns, perforations, material estimation, printability analysis, STL, STEP, or advanced presets.
- Work-unit commits are deferred because this session policy requires explicit user authorization before commits.
