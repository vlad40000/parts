# Workflow State

## Current Goal
Build the internal multi-manufacturer Appliance BOM Workbench, wiring the Python Gemini extraction pipeline into the Next.js scaffold.

## Completed Tasks
- Audited repository structure and contracts.
- Completed Task 0: documented Python pipeline and Neon schema mappings in `docs/handoff-discrepancies.md`.
- Created `Dockerfile` and `.dockerignore` for the workbench server.
- Added the production `start` script to `package.json`.
- Step 2 - Cache scope locked:
  - `services/extraction/cache/` is local/dev-only and retains `.gitkeep`.
  - Production cache remains a follow-up Neon `extraction_cache` table.
  - Production pipeline runs do not write local benchmark files.
- Step 3 - Python extraction endpoint created:
  - `api/extract/cold-sync.py` is the extraction worker only.
  - Accepts `job_id`, `model_number`, `brand`, `appliance_type`, `serial`, and `mode`.
  - Dispatches to fast or warm pipeline mode and returns a validated scaffold contract.
  - Quarantines all price-like extraction fields as raw evidence.
  - Performs no Neon writes and does not mutate BOM job status.
- Step 4 - Next.js extraction orchestration implemented:
  - `app/api/internal/bom/jobs/[jobId]/extract/route.ts` uses Node runtime.
  - Loads the Neon job, calls `/api/extract/cold-sync`, validates with Zod, and persists in one transaction.
  - Adds append-only extraction runs, job events, diagram sections, and raw part observations.
  - Supersedes prior active canonical rows without deleting extraction history or evidence.
  - Moves successful or partial extraction to `pricing_pending` / `extraction_complete`.
  - Never writes Python price-like fields to normalized pricing columns.
  - Adds migration `0002_extraction_orchestration`.
- Step 4.5 - Extraction orchestration migration applied and verified:
  - Applied `0002_extraction_orchestration` to the configured Neon database.
  - Verified `extraction_runs` and `bom_job_events`.
  - Verified extraction-run links on diagram sections, part observations, and canonical parts.
  - Verified canonical `lifecycle_status` and `superseded_at`.
  - Neon smoke test passed for extraction audit persistence, pricing constraints, and temporary-row cleanup.

## Cache Rule
| Scope | Path | Durable |
|-------|------|---------|
| Local/dev bench | `services/extraction/cache/` | No |
| Production | Neon `extraction_cache` table | Yes |

## Endpoint Ownership
| Layer | File | Owns |
|-------|------|------|
| Python worker | `api/extract/cold-sync.py` | Extraction, payload mapping, pricing quarantine |
| Next.js orchestration | `app/api/internal/bom/jobs/[jobId]/extract/route.ts` | Job fetch, worker HTTP call, DB transaction, status update |

## Validation
- `npm run validate:pricing-policy` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed: 4 files, 14 tests.
- `npm run build` passed.
- Python syntax compilation passed for the worker and pipeline.

- Step 5 - UI extraction action implemented:
  - Rewrote `app/internal/bom/bom-workbench-client.tsx`.
  - "Run Extraction" button with `fast` / `warm` mode selector; disabled while running.
  - POSTs `{ mode }` to `/api/internal/bom/jobs/[jobId]/extract`.
  - Phase badge cycles: `extraction_running` → `extraction_complete` or `extraction_failed`.
  - Success panel shows: diagram sections, part observations, canonical parts, warnings, run ID.
  - Failure panel shows the structured error from the route — no generic spinner hiding failures.
  - Parts shown as "pricing_pending" only. No price labels, no price display post-extraction.
  - Identity/console flow and other pipeline step buttons remain untouched.
  - Validation: pricing-policy PASS, lint PASS, typecheck PASS, tests 14/14 PASS, build PASS.

- Step 6 - Live end-to-end extraction smoke test (Ready for testing):
  - Migrated Python pipeline to use the official `google-genai` SDK.
  - Replaced hard-coded `GEMINI_API_KEY` mapping with the recommended `client = genai.Client()`.
  - Added `google-genai` to `requirements.txt`.
  - Added `GEMINI_API_KEY=your_key_here` to `.env.local`.
  - Verified extraction runs successfully in Vercel Production by securely configuring the `GEMINI_API_KEY` Environment Variable and triggering a test against `/api/extract/cold-sync`.
- Deployment worker configuration:
  - Added `vercel.json` with a 60-second duration and 1024 MB memory for `api/extract/cold-sync.py`.
  - Documented `INTERNAL_APP_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET`, and `GEMINI_API_KEY` in `.env.example`.
  - Confirmed the extraction route already sends Vercel protection-bypass headers when configured.
  - Cleaned null-byte corruption from `.gitignore` and preserved secret env-file exclusions.
  - `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
  - Local `vercel build --prod` compiles Next.js and creates serverless functions, but Vercel CLI 50.12.3 fails during final local packaging by requesting a lambda for a valid static prerendered page. No static pages were converted to server functions as a workaround.

## Next Steps
1. **Execute Step 6 Smoke Test**: Trigger a full extraction via the UI on production (https://appliance-parts-pipeline.vercel.app/) and verify the DB results.
2. Step 7: Encompass / D&L Parts pricing adapter.
3. Follow-up: Wire `run_pipeline_warm` to Neon `extraction_cache` table (requires migration first).

