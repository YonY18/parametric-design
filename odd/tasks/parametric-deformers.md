# Parametric Deformers

## Goal
Extract Wave Lamp deformation math into reusable, ordered, chainable parametric deformers while preserving the existing Wave Lamp behavior and generic UI architecture.

## Tasks
- [x] Add generic deformer and section-aware parameter schema types.
- [x] Implement reusable Taper, Wave, Twist, Bulge, Vertical Wave deformers plus ordered pipeline validation.
- [x] Integrate Wave Lamp through the deformer pipeline without changing its default silhouette.
- [x] Render Shape/deformer controls through generic schema sections, not Wave-Lamp-specific UI code.
- [x] Expose Wave Lamp Shape > Taper enabled, bottom-scale, and top-scale controls with validated defaults.
- [x] Add focused unit tests for deformer math and pipeline order.
- [x] Document the deformer architecture and run test, lint, typecheck, and build.

## Evidence
- `src/geometry/deformers.ts` contains the mutable polar vertex contract, five reusable deformers, relative Taper `bottomScale`/`topScale` semantics, disabled-deformer handling, and ordered `applyDeformers` validation.
- `src/geometry/waveLamp.ts` builds the base diameter frustum, passes all five enabled flags into the pipeline, and reuses one mutable vertex without hot-loop allocations.
- `src/generators/wave-lamp.ts` preserves the existing defaults, exposes generic enabled and Taper scale parameters, and groups Taper, Wave, Twist, Bulge, and Vertical Wave separately.
- `src/geometry/waveLamp.ts` forwards Taper scales into the ordered pipeline while preserving disabled-Taper no-op behavior.
- `src/parametric/types.ts`, `src/store/modelStore.ts`, and `src/components/ParameterPanel.tsx` support generic boolean parameters alongside legacy flat schemas and grouped sections.
- `tests/deformers.test.ts` explicitly covers endpoint Taper scales, endpoint Twist behavior, zero-amplitude no-ops, Bulge center behavior, disabled deformers, and observable pipeline order.
- Validation passed: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`, including Taper scale forwarding and disabled no-op coverage.

## Notes
- No visual stack editor, drag and drop, undo/redo, presets, curves, procedural noise, Voronoi, booleans, lamp holder, print analysis, or unrelated changes.
- Work-unit commits are deferred because this session policy requires explicit user authorization before commits.
