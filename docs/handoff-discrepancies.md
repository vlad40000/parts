# Appliance BOM Workbench - Handoff Discrepancies

This document tracks schema differences between the Python-based extraction pipeline (`appliance_parts_pipeline.py`) and the `parts-main` Neon DB Schema (`schema.sql`), and outlines how these discrepancies are resolved in the `to_scaffold_payload()` mapping function.

## 1. Part Confidence & Status Mapping
- **Pipeline Output:** `part_number_status` as `Enum("confirmed", "probable", "unconfirmed")`
- **Neon Schema:** `part_identity_confidence` as `numeric(5,4)` (0 to 1).
- **Resolution:** Mapped explicitly:
  - `"confirmed"` → `1.0`
  - `"probable"` → `0.7`
  - `"unconfirmed"` → `0.3`

## 2. Diagram Sections (Source vs Normalized)
- **Pipeline Output:** `section_name` and an array of `aliases` are discovered across sources.
- **Neon Schema:** Distinguishes `source_section_name` vs `normalized_section_name`.
- **Resolution:** The Python pipeline already consolidates sections into canonical forms using LLMs (Step 3). We set both `source_section_name` and `normalized_section_name` to the pipeline's canonical `section_name`.

## 3. Appliance Class Parsing
- **Pipeline Output:** Extracts arbitrary `appliance_type` strings from nameplates/manuals (e.g. "Top-load Washer").
- **Neon Schema:** Restricts `appliance_class` to exactly: `washer`, `dryer`, `refrigerator`, `stove`, `range`, `oven`, `freezer`, `unknown`.
- **Resolution:** Case-insensitive substring matching coercions. E.g. if "washer" is in "Top-load Washer", it gets mapped to `washer`. Otherwise falls back to `unknown`.

## 4. Provenance Tracking (Observations)
- **Pipeline Output:** Uses a custom `_provenance` dictionary mapping deduped keys to count and sources.
- **Neon Schema:** Has `canonical_bom_parts.discovery_source_count` and raw `part_observations`.
- **Resolution:** The `to_scaffold_payload()` computes the `.discovery_source_count` on canonical rows using the provenance dictionary length. We'll set `verification_status` to `"single_source"` if count is 1, and `"cross_verified"` if count > 1.

## 5. Part Numbers Mapping
- **Pipeline Output:** Yields only `manufacturer_part_number`.
- **Neon Schema:** Has `discovered_part_number`, `manufacturer_part_number`, and `substitute_part_number`.
- **Resolution:** Both `discovered_part_number` and `manufacturer_part_number` get assigned the MPN found by the pipeline. `substitute_part_number` remains null as pipeline doesn't extract cross-compatibility explicitly.
