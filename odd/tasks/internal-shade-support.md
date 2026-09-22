# Internal Shade Support

## Goal
Replace the mounted Wave Lamp radius-convergence strategy with a hidden internal mechanical core: the decorative shade keeps its exterior profile, while a threaded hub and internal support plate connect the shade to the mount inside the body.

## Tasks
- [x] Remove mounted DecorativeShadeRadius → MountRadius convergence and keep decorative shade exterior independent from hub/thread/mount dimensions.
- [x] Add ThreadedHub plus annular Internal Shade Support geometry that reaches the shade inner profile at `supportInset` without deforming the exterior silhouette.
- [x] Keep Retaining Ring compact around the hub/attachment interface and preserve detachable Mount/Ring/Shade parts.
- [x] Add section/debug metadata and regression tests for exterior independence, support contact, circular hub, finite geometry, and inset placement.
- [x] Run tests, lint, typecheck, build, and record validation evidence.

## Evidence
- Mounted composition now emits `mount`, `mount-seat`, `threaded-hub`, `internal-support`, `decorative-shade`, and `retaining-ring` parts; no mounted `transition` or `shade-neck` part is generated.
- `tests/lamp-mounts.test.ts` covers hub/thread/mount exterior independence, profile contact, circular hub, deformation preservation, inset placement, finite geometry, bad triangles, unsupported support types, and retaining-ring compactness.
- `node --experimental-strip-types --loader ./tests/ts-extension-loader.mjs tests/lamp-mounts.test.ts`: passed.
- `npm test`: passed.
- `npx eslint src/geometry/attachmentInterface.ts src/geometry/waveLamp.ts src/geometry/internalShadeSupport.ts src/geometry/threadedHub.ts src/generators/wave-lamp.ts src/cad/procedural-backend.ts src/geometry/types.ts src/viewer/Viewport.tsx tests/lamp-mounts.test.ts`: passed.
- `npx tsc --noEmit -p tsconfig.app.json`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed with Vite's existing large-chunk warning.
- Internal support outer side faces are omitted so the support edge sits on the shade inner profile without adding duplicate coplanar faces against the wall.

## Notes
- Commits are deferred because this session policy requires explicit user authorization before commits.
