# Parametric Design

A parametric 3D modeling workspace built with Vite, React, TypeScript, Three.js, Zustand, and Replicad/OpenCascade WASM.

## Run locally

```bash
npm install
npm run dev
```

Validation scripts:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The deformer checks use Node's built-in TypeScript stripping and do not add a test dependency.

## Architecture

The app keeps model definitions, geometry generation, worker messaging, state, and rendering separate:

- `src/parametric/` — generic model-definition types and the model registry. Parameter controls are rendered from each definition; no generator-specific controls live in the UI.
- `src/generators/` — generator-owned metadata, parameter schemas, validation, defaults, reset/randomize behavior, and serializable generation requests for the cylinder and procedural Wave Lamp.
- `src/geometry/` — backend-independent mesh contracts plus the Wave Lamp surface generator, which builds a closed hollow wall with radial wave thickness.
- `src/geometry/deformers.ts` — reusable, ordered polar deformers. Each deformer exposes an `id`, display `name`, `enabled` flag, numeric `parameters`, and an in-place `apply` function. The shared pipeline skips disabled deformers and reports non-finite or non-positive radii.
- Wave Lamp starts with a bottom/top diameter frustum, then applies the ordered `Taper -> Wave -> Twist -> Bulge -> Vertical Wave` pipeline. Shape > Taper exposes generic enabled, bottom-scale, and top-scale controls; scales default to relative `bottomScale: 1` / `topScale: 1`, so the default values preserve the original silhouette. The inner radius is the outer radius minus `wallThickness`, and top/bottom caps close the wall. Generation reuses one mutable polar vertex to avoid per-vertex object allocation.
- Parameter schemas can be a legacy flat list or generic sections containing groups, so the inspector renders model-owned Shape/deformer controls without Wave Lamp-specific JSX.
- `src/cad/` — Replicad/OpenCascade and procedural backends. Both return transferable positions, indices, and normals.
- `src/workers/cad.worker.ts` — initializes OpenCascade only for Replicad requests and runs all generation off the UI thread.
- `src/cad/cadClient.ts` — typed request/response client for the worker.
- `src/store/modelStore.ts` — Zustand state for the selected model, parameter values, generation status, errors, and latest valid mesh. Parameter changes are debounced and stale worker responses are ignored.
- `src/viewer/Viewport.tsx` — imperative Three.js scene with perspective camera, OrbitControls, grid, lights, resize handling, camera-preserving geometry replacement, fit-to-object, and real bounding-box dimensions.
- `src/components/` — the generator library and dynamic parameter inspector.
- `src/app/` — application shell and visual styling.

The backend contract is intentionally small so future procedural mesh or other CAD backends can implement the same request/mesh boundary. Authentication, persistence, sketches, assemblies, history, and exports remain outside the current scope.
