-- Neon-ready baseline schema for the Appliance BOM Workbench.
-- This is intentionally additive and provenance-first.

CREATE TABLE IF NOT EXISTS bom_jobs (
  id text PRIMARY KEY,
  model_number text NOT NULL,
  serial_number text,
  manufacturer text,
  appliance_class text NOT NULL DEFAULT 'unknown',
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_evidence (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id),
  source_name text NOT NULL,
  source_url text NOT NULL,
  raw_evidence_hash text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_observations (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id),
  part_number_used text NOT NULL,
  pricing_source text,
  price numeric,
  currency text NOT NULL DEFAULT 'USD',
  availability text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pricing_source IS NULL OR pricing_source IN ('encompass', 'dlpartsco'))
);

CREATE TABLE IF NOT EXISTS canonical_bom_parts (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES bom_jobs(id),
  section_name text,
  diagram_ref text,
  part_number text,
  part_title text,
  price numeric,
  pricing_source text,
  verification_status text NOT NULL DEFAULT 'unverified',
  CHECK (pricing_source IS NULL OR pricing_source IN ('encompass', 'dlpartsco'))
);
