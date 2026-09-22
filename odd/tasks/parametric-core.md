# Parametric Core

## Goal
Create the first-stage web app architecture for a parametric 3D modeling tool focused on 3D printing, without building a full CAD.

## Tasks
- [x] Scaffold Vite/React/TypeScript app with modular folders.
- [x] Implement dynamic parametric model definitions, Zustand state, and parameter panel.
- [x] Implement Three.js viewport with camera, orbit controls, grid, lights, resize, and fit-to-object.
- [x] Implement geometry backend abstraction and CAD worker using Replicad/OpenCascade WASM.
- [x] Add Parametric Cylinder generator and worker regeneration flow.
- [x] Document architecture and run lint/typecheck/build.

## Evidence
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite emitted the application, worker, and OpenCascade WASM asset.
- Build output `dist/` was removed after validation and added to `.gitignore`.
- Work-unit commit: initial commit (`feat: scaffold parametric modeling core`).

## Notes
- No auth, backend, DB, AI, sketches, assemblies, complex history, advanced lamps, Voronoi, or 3MF in this stage.
- `tsconfig.app.json` is intentionally kept because `tsconfig.json` references it and Vite/TypeScript app config belongs in source control.
- Git repository initialized with `origin` set to `git@github.com:YonY18/parametric-design.git`.
