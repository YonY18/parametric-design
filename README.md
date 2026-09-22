# Parametric Design

A first-stage parametric 3D modeling workspace built with Vite, React, TypeScript, Three.js, Zustand, and Replicad/OpenCascade WASM.

## Run locally

```bash
npm install
npm run dev
```

Validation scripts:

```bash
npm run lint
npm run typecheck
npm run build
```

## Architecture

The app keeps model definitions, geometry generation, worker messaging, state, and rendering separate:

- `src/parametric/` — generic model-definition types and the model registry. Parameter controls are rendered from each definition; no generator-specific controls live in the UI.
- `src/generators/cylinder.ts` — first model definition, including defaults, numeric constraints, units, and the serializable Replicad generation request.
- `src/geometry/` — backend-independent mesh and generation request contracts.
- `src/cad/replicad-backend.ts` — Replicad/OpenCascade implementation. It validates cylinder parameters, cuts a slightly oversized inner cylinder, and adapts the tessellation to transferable mesh buffers.
- `src/workers/cad.worker.ts` — initializes OpenCascade once in a module Web Worker and runs backend requests off the UI thread.
- `src/cad/cadClient.ts` — typed request/response client for the worker.
- `src/store/modelStore.ts` — Zustand state for the selected model, parameter values, generation status, errors, and latest mesh. Stale worker responses are ignored.
- `src/viewer/Viewport.tsx` — imperative Three.js scene with perspective camera, OrbitControls, grid, lights, resize handling, fit-to-object, and one mutable mesh geometry.
- `src/components/` — the generator library and dynamic parameter inspector.
- `src/app/` — application shell and visual styling.

The backend contract is intentionally small so future procedural mesh or other CAD backends can implement the same request/mesh boundary. The current stage intentionally excludes authentication, persistence, sketches, assemblies, history, exports, and additional generators.

## Repository note

This project is not currently initialized as a Git repository, so commit evidence is unavailable. `odd/tasks/parametric-core.md` tracks the implementation scope and validation evidence.
