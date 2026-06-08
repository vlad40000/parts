# Appliance BOM Workbench

New build target for `vlad40000/parts`.

This is an internal RoadrunnerParts appliance BOM workbench. It is intentionally built as a new Next.js App Router application rather than a patch to the old public Vite homepage.

## Core rules

- Model number is the lowest required intake field.
- Brand/OEM unknown lowers confidence but does not block model-only discovery.
- Discovery and pricing are separate lanes.
- Discovery sources may find diagrams, sections, diagram refs, part numbers, titles, substitutions, source URLs, raw text, and raw evidence hashes.
- Discovery sources may not populate normalized pricing.
- Final normalized price fields may only come from:
  - Encompass
  - D&L Parts lookup
- Gemini may navigate, classify, reconcile, compare, and flag anomalies.
- Gemini may not invent part numbers, prices, substitutions, section membership, appliance compatibility, or manufacturer identity.

## Initial routes

- `/` — internal landing page
- `/internal/console` — model/nameplate identity intake
- `/internal/bom` — BOM job shell
- `/api/console/resolve-identity` — identity resolver
- `/api/internal/bom/jobs` — create/list in-memory placeholder jobs
- `/api/internal/bom/jobs/[jobId]/*` — discovery/extract/price/verify/export placeholders

## Validation commands

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run validate:pricing-policy
```

The local build may require internet access to install npm dependencies.

## Next implementation phase

Replace the in-memory job store with Neon persistence and implement deterministic discovery, extraction, merge, Encompass/D&L pricing adapters, and the verifier gate.
