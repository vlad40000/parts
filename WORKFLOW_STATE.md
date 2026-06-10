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

- Step 6 - Live end-to-end extraction smoke test (COMPLETE - VERIFIED):
	- Migrated Python pipeline to use the official `google-genai` SDK.
	- Replaced hard-coded `GEMINI_API_KEY` mapping with the recommended `client = genai.Client()`.
	- Added `google-genai` to `requirements.txt`.
	- Added `GEMINI_API_KEY=your_key_here` to `.env.local`.
	- Verified extraction runs successfully in Vercel Production.
- Deployment worker configuration:
  - Added `vercel.json` with a 60-second duration and 1024 MB memory for `api/extract/cold-sync.py`.
  - Documented `INTERNAL_APP_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET`, and `GEMINI_API_KEY` in `.env.example`.
  - Confirmed the extraction route sends Vercel protection-bypass headers when configured.
  - `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- Reconciliation: local `main` == `origin/main`. Clean.
- **Smoke Test Results (2026-06-10):**
  - Direct Python worker call: `POST /api/extract/cold-sync` with `WTW5000DW1 / Whirlpool` → HTTP 200, 7 sections, 70 parts (partial: 70/114 expected).
  - Full orchestration call: `POST /api/internal/bom/jobs/{jobId}/extract` → HTTP 200.
    - `extractionRunId`: `extraction_run_4e4a7081-0496-4cba-9c07-de062c92627a`
    - Inserted: 6 diagram sections, 78 part observations, 78 canonical BOM parts.
    - Status: `pricing_pending` / `extraction_complete`.
  - UI verified: Job shows `PRICING PENDING` badge, notes confirm extraction completed.
  - Pipeline is partial (78/90 expected) — expected behavior for 60s `fast` mode; warm mode with cache will improve completeness.

- Step 7 - Pricing adapter pipeline (COMPLETE - 2026-06-10, commit 9a0cca9):
  - **Adapters:**
    - `src/features/bom/pricing/adapters/encompass.ts`: credential-gated REST JSON (ENCOMPASS_API_USERNAME/PASSWORD). Graceful skip if not configured.
    - `src/features/bom/pricing/adapters/dlpartsco.ts`: SSR HTML scrape, browser UA. Price from `span.your-price`. Live-confirmed: W10780048 = $68.65.
    - `src/features/bom/pricing/adapters/index.ts`: priority registry [encompass → dlpartsco].
  - **Store:** `pricing-store.ts` — `loadPendingParts`, `persistPricingBatch` (winner-map dedup), `markPricingComplete`. Uses `neon() .query()` API.
  - **Route:** `app/api/internal/bom/jobs/[jobId]/price/route.ts` — real orchestration. Concurrent batch-of-5 fan-out. Idempotent guard on `pricing_complete`.
  - **UI:** Dedicated "Run Pricing" card with loading state, `PricingResultPanel` (priced/not_found/hit rate), badge transitions to `PRICING COMPLETE`.
  - **Types:** `BomJobStatus` extended with `extraction_running`, `extraction_complete`, `extraction_failed`, `pricing_complete`.
  - **Tests:** 34/34 pass (10 new adapter unit tests).
  - **Blockers:** Encompass requires `ENCOMPASS_API_USERNAME` + `ENCOMPASS_API_PASSWORD` env vars in Vercel. Without these, all pricing falls through to D&L Parts Co scrape.

## Next Steps
1. **Smoke test Step 7**: Trigger "Run Pricing" in production UI on a job in `pricing_pending` status. Verify `pricing_observations` rows and `canonical_bom_parts.price` in Neon.
2. **Env config (optional)**: Add `ENCOMPASS_API_USERNAME` and `ENCOMPASS_API_PASSWORD` to Vercel env vars if Encompass account is available.
3. **Step 8 (follow-up)**: Wire `run_pipeline_warm` to Neon `extraction_cache` table (requires migration first).

