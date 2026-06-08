-- Appliance BOM Workbench baseline schema.
-- Keep statements additive so this can safely initialize an empty Neon database
-- or fill missing objects in a partially initialized database.

CREATE TABLE IF NOT EXISTS bom_jobs (
  id text PRIMARY KEY,
  model_number text NOT NULL,
  serial_number text,
  input_brand text,
  manufacturer text,
  product_type text,
  appliance_class text NOT NULL DEFAULT 'unknown',
  resolution_state text NOT NULL,
  identity_confidence numeric(5,4) NOT NULL DEFAULT 0,
  identity_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'intake',
  current_phase text NOT NULL DEFAULT 'identity',
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bom_jobs_identity_confidence_check
    CHECK (identity_confidence >= 0 AND identity_confidence <= 1)
);
-- statement-breakpoint

ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS input_brand text;
ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS product_type text;
ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS resolution_state text NOT NULL DEFAULT 'unknown_model_only_allowed';
ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS identity_confidence numeric(5,4) NOT NULL DEFAULT 0;
ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS identity_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS current_phase text NOT NULL DEFAULT 'identity';
ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS notes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bom_jobs ADD COLUMN IF NOT EXISTS error_message text;
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS appliance_identities (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  model_number text NOT NULL,
  serial_number text,
  input_brand text,
  resolved_manufacturer text,
  product_type text,
  appliance_class text NOT NULL DEFAULT 'unknown',
  resolution_state text NOT NULL,
  identity_confidence numeric(5,4) NOT NULL DEFAULT 0,
  input_source text NOT NULL,
  brand_input_source text NOT NULL DEFAULT 'none',
  brand_resolution_origin text NOT NULL DEFAULT 'unresolved',
  raw_ocr_candidates jsonb,
  raw_serial_decode jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appliance_identities_confidence_check
    CHECK (identity_confidence >= 0 AND identity_confidence <= 1)
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS diagram_sources (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'found',
  raw_evidence_hash text,
  blocked_reason text,
  discovered_by text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS diagram_sections (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  diagram_source_id text REFERENCES diagram_sources(id) ON DELETE SET NULL,
  source_section_name text NOT NULL,
  normalized_section_name text,
  section_url text,
  diagram_image_url text,
  observed_part_count integer,
  display_order integer,
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  verification_status text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagram_sections_observed_part_count_check
    CHECK (observed_part_count IS NULL OR observed_part_count >= 0),
  CONSTRAINT diagram_sections_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS source_evidence (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text,
  source_name text NOT NULL,
  source_url text NOT NULL,
  visible_evidence_quote text,
  raw_evidence_hash text NOT NULL,
  raw_payload jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint

ALTER TABLE source_evidence ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'job';
ALTER TABLE source_evidence ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE source_evidence ADD COLUMN IF NOT EXISTS visible_evidence_quote text;
ALTER TABLE source_evidence ADD COLUMN IF NOT EXISTS raw_payload jsonb;
ALTER TABLE source_evidence ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS part_observations (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  diagram_section_id text REFERENCES diagram_sections(id) ON DELETE SET NULL,
  source_evidence_id text REFERENCES source_evidence(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  section_name text NOT NULL,
  diagram_ref text,
  part_number text,
  manufacturer_part_number text,
  substitute_part_number text,
  part_title text,
  diagram_image_url text,
  raw_evidence_hash text NOT NULL,
  extraction_method text NOT NULL,
  extraction_status text NOT NULL DEFAULT 'extracted',
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  raw_payload jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT part_observations_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS canonical_bom_parts (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  model_number text,
  serial_number text,
  manufacturer text,
  appliance_class text NOT NULL DEFAULT 'unknown',
  section_source_name text,
  section_normalized text,
  diagram_ref text,
  diagram_image_url text,
  discovered_part_number text,
  manufacturer_part_number text,
  substitute_part_number text,
  part_title text,
  discovery_source_count integer NOT NULL DEFAULT 0,
  part_identity_confidence numeric(5,4) NOT NULL DEFAULT 0,
  price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  pricing_source text,
  pricing_source_url text,
  pricing_part_number_used text,
  availability text,
  price_observed_at timestamptz,
  pricing_status text NOT NULL DEFAULT 'pending',
  pricing_confidence numeric(5,4) NOT NULL DEFAULT 0,
  verification_status text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_bom_parts_pricing_source_check
    CHECK (pricing_source IS NULL OR pricing_source IN ('encompass', 'dlpartsco')),
  CONSTRAINT canonical_bom_parts_price_check
    CHECK (price IS NULL OR price >= 0),
  CONSTRAINT canonical_bom_parts_discovery_source_count_check
    CHECK (discovery_source_count >= 0),
  CONSTRAINT canonical_bom_parts_identity_confidence_check
    CHECK (part_identity_confidence >= 0 AND part_identity_confidence <= 1),
  CONSTRAINT canonical_bom_parts_pricing_confidence_check
    CHECK (pricing_confidence >= 0 AND pricing_confidence <= 1)
);
-- statement-breakpoint

ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS model_number text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS appliance_class text NOT NULL DEFAULT 'unknown';
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS section_source_name text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS section_normalized text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS diagram_image_url text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS discovered_part_number text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS manufacturer_part_number text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS substitute_part_number text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS discovery_source_count integer NOT NULL DEFAULT 0;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS part_identity_confidence numeric(5,4) NOT NULL DEFAULT 0;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS pricing_source_url text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS pricing_part_number_used text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS availability text;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS price_observed_at timestamptz;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS pricing_status text NOT NULL DEFAULT 'pending';
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS pricing_confidence numeric(5,4) NOT NULL DEFAULT 0;
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE canonical_bom_parts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS pricing_observations (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  canonical_part_id text REFERENCES canonical_bom_parts(id) ON DELETE SET NULL,
  part_number_used text NOT NULL,
  pricing_source text,
  pricing_source_url text,
  price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  availability text,
  pricing_status text NOT NULL DEFAULT 'pending',
  pricing_confidence numeric(5,4) NOT NULL DEFAULT 0,
  raw_evidence_hash text,
  raw_payload jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_observations_source_check
    CHECK (pricing_source IS NULL OR pricing_source IN ('encompass', 'dlpartsco')),
  CONSTRAINT pricing_observations_price_check
    CHECK (price IS NULL OR price >= 0),
  CONSTRAINT pricing_observations_confidence_check
    CHECK (pricing_confidence >= 0 AND pricing_confidence <= 1)
);
-- statement-breakpoint

ALTER TABLE pricing_observations ADD COLUMN IF NOT EXISTS canonical_part_id text REFERENCES canonical_bom_parts(id) ON DELETE SET NULL;
ALTER TABLE pricing_observations ADD COLUMN IF NOT EXISTS pricing_source_url text;
ALTER TABLE pricing_observations ADD COLUMN IF NOT EXISTS pricing_status text NOT NULL DEFAULT 'pending';
ALTER TABLE pricing_observations ADD COLUMN IF NOT EXISTS pricing_confidence numeric(5,4) NOT NULL DEFAULT 0;
ALTER TABLE pricing_observations ADD COLUMN IF NOT EXISTS raw_evidence_hash text;
ALTER TABLE pricing_observations ADD COLUMN IF NOT EXISTS raw_payload jsonb;
ALTER TABLE pricing_observations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS bom_conflicts (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  canonical_part_id text REFERENCES canonical_bom_parts(id) ON DELETE SET NULL,
  conflict_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  details jsonb NOT NULL,
  resolution jsonb,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS agent_events (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  model_name text,
  stage text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL,
  input_payload jsonb,
  output_payload jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS verification_results (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  status text NOT NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_next_action text NOT NULL,
  verifier_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_results_status_check
    CHECK (status IN ('PASS', 'PASS_WITH_FLAGS', 'FAIL'))
);
-- statement-breakpoint

CREATE TABLE IF NOT EXISTS export_artifacts (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id) ON DELETE CASCADE,
  export_type text NOT NULL,
  format text NOT NULL,
  storage_url text,
  content_hash text,
  row_count integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT export_artifacts_row_count_check
    CHECK (row_count IS NULL OR row_count >= 0)
);
-- statement-breakpoint

CREATE INDEX IF NOT EXISTS appliance_identities_job_id_idx ON appliance_identities(job_id);
CREATE INDEX IF NOT EXISTS diagram_sources_job_id_idx ON diagram_sources(job_id);
CREATE INDEX IF NOT EXISTS diagram_sections_job_id_idx ON diagram_sections(job_id);
CREATE INDEX IF NOT EXISTS part_observations_job_id_idx ON part_observations(job_id);
CREATE INDEX IF NOT EXISTS part_observations_part_number_idx ON part_observations(part_number);
CREATE INDEX IF NOT EXISTS canonical_bom_parts_job_id_idx ON canonical_bom_parts(job_id);
CREATE INDEX IF NOT EXISTS canonical_bom_parts_part_number_idx ON canonical_bom_parts(discovered_part_number);
CREATE INDEX IF NOT EXISTS pricing_observations_job_id_idx ON pricing_observations(job_id);
CREATE INDEX IF NOT EXISTS source_evidence_job_id_idx ON source_evidence(job_id);
CREATE INDEX IF NOT EXISTS bom_conflicts_job_id_idx ON bom_conflicts(job_id);
CREATE INDEX IF NOT EXISTS agent_events_job_id_idx ON agent_events(job_id);
CREATE INDEX IF NOT EXISTS verification_results_job_id_idx ON verification_results(job_id);
CREATE INDEX IF NOT EXISTS export_artifacts_job_id_idx ON export_artifacts(job_id);
CREATE INDEX IF NOT EXISTS bom_jobs_updated_at_idx ON bom_jobs(updated_at DESC);
