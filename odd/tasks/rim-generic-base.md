# Rim Generic Base

## Goal
Redesign the lamp mechanical ending so the decorative shade ends in a stable circular RimInterface, then attaches to a reusable Generic Base (Flat Disc or Recessed Step) that owns the central mount/thread feature.

## Tasks

- [x] Explore current shade/base architecture and identify edit surfaces.
- [x] Implement RimInterface, BaseRimProfile, GenericBase generation, and mount feature ownership.
- [x] Update wave lamp parameters/schema so Base and Rim expose only primary controls and derive dependent dimensions.
- [x] Replace legacy mounted assembly with Decorative Shade → Rim Interface → Generic Base → Mount Feature.
- [x] Add/refresh architecture documentation for RimInterface + GenericBase.
- [x] Add tests covering flat/recessed bases, circular rim, derived profiles, centered thread, finite/non-negative geometry, and support-like base behavior.
- [x] Fix verifier concerns: base-owned rim profile, validated structural joins, flat-disc center-hole limits, and non-tubular base coverage.
- [x] Run test, lint, typecheck, and build.

## Evidence

- `npm test` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite emitted only the existing large-chunk warning.
- No commit created per user request.
