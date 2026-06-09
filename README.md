# Appliance BOM Workbench

New build target for `vlad40000/parts`.

This is an internal RoadrunnerParts appliance BOM workbench built with the
Next.js App Router.

## Core rules

- Model number is the lowest required intake field.
- Unknown brand or OEM lowers confidence but does not block model-only discovery.
- Discovery and pricing are separate lanes.
- Discovery sources may not populate normalized pricing.
- Final normalized prices may only come from Encompass or D&L Parts lookup.
- Gemini may navigate, classify, reconcile, compare, and flag anomalies.
- Gemini may not invent part numbers, prices, substitutions, section membership,
  appliance compatibility, or manufacturer identity.

## Routes

- `/` - internal landing page
- `/internal/console` - model and nameplate identity intake
- `/internal/bom` - BOM job shell
- `/api/console/resolve-identity` - identity resolver
- `/api/internal/bom/jobs` - create and list Neon-backed jobs
- `/api/internal/bom/jobs/[jobId]/*` - job workflow endpoints

## Neon schema

Copy `.env.example` to `.env.local` and provide the pooled and unpooled Neon
connection strings.

Apply the additive baseline:

```bash
npm run db:migrate
```

Inspect the required tables and pricing constraints:

```bash
npm run db:inspect
```

Run a temporary insert, constraint, and cascading-delete check:

```bash
npm run db:smoke
```

The schema includes:

- `bom_jobs`
- `appliance_identities`
- `diagram_sources`
- `diagram_sections`
- `extraction_runs`
- `bom_job_events`
- `part_observations`
- `canonical_bom_parts`
- `pricing_observations`
- `source_evidence`
- `bom_conflicts`
- `agent_events`
- `verification_results`
- `export_artifacts`

## Validation

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run validate:pricing-policy
```

## Next phase

Implement deterministic discovery, extraction, canonical merge, Encompass/D&L
pricing adapters, and the verification gate.
