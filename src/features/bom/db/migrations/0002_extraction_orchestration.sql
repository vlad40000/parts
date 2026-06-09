CREATE TABLE IF NOT EXISTS extraction_runs (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  adapter_name text NOT NULL,
  adapter_version text,
  mode text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  latency_ms integer,
  raw_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extraction_runs_mode_check CHECK (mode IN ('fast', 'warm')),
  CONSTRAINT extraction_runs_status_check CHECK (status IN ('ok', 'partial', 'failed')),
  CONSTRAINT extraction_runs_latency_check CHECK (latency_ms IS NULL OR latency_ms >= 0)
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS bom_job_events (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  extraction_run_id text REFERENCES extraction_runs(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  status text NOT NULL,
  phase text NOT NULL,
  note text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint

ALTER TABLE diagram_sections
  ADD COLUMN IF NOT EXISTS extraction_run_id text REFERENCES extraction_runs(id) ON DELETE RESTRICT;
ALTER TABLE part_observations
  ADD COLUMN IF NOT EXISTS extraction_run_id text REFERENCES extraction_runs(id) ON DELETE RESTRICT;
ALTER TABLE canonical_bom_parts
  ADD COLUMN IF NOT EXISTS extraction_run_id text REFERENCES extraction_runs(id) ON DELETE RESTRICT;
ALTER TABLE canonical_bom_parts
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active';
ALTER TABLE canonical_bom_parts
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
-- statement-breakpoint

CREATE INDEX IF NOT EXISTS extraction_runs_job_id_idx ON extraction_runs(job_id);
CREATE INDEX IF NOT EXISTS bom_job_events_job_id_idx ON bom_job_events(job_id);
CREATE INDEX IF NOT EXISTS diagram_sections_extraction_run_id_idx ON diagram_sections(extraction_run_id);
CREATE INDEX IF NOT EXISTS part_observations_extraction_run_id_idx ON part_observations(extraction_run_id);
CREATE INDEX IF NOT EXISTS canonical_bom_parts_extraction_run_id_idx ON canonical_bom_parts(extraction_run_id);
CREATE INDEX IF NOT EXISTS canonical_bom_parts_active_job_idx
  ON canonical_bom_parts(job_id)
  WHERE lifecycle_status = 'active';
