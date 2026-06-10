"""
api/extract/cold-sync.py
Vercel Python serverless function — extraction worker only.

Responsibilities:
  - Accept POST JSON describing a single appliance job.
  - Run run_pipeline_fast() or run_pipeline_warm() based on `mode`.
  - Convert output via to_scaffold_payload().
  - Quarantine any pricing fields not sourced from Encompass or D&L.
  - Return JSON extraction payload.

NOT responsible for:
  - Writing to Neon (no DB mutations here).
  - Updating job status (owned by the Next.js orchestration route).
  - Marking jobs as pricing_pending or priced.

Pricing source policy:
  Only encompass.com and dlpartscolookup.com/lookup are trusted normalized
  pricing authorities. This worker does not normalize prices; any price-like
  extraction output is quarantined for later review.
"""

from __future__ import annotations

import json
import os
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Path resolution: allow imports from the monorepo services/extraction dir
# when Vercel bundles this file as a standalone serverless function.
# ---------------------------------------------------------------------------
_SERVICES_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "services", "extraction")
if _SERVICES_PATH not in sys.path:
    sys.path.insert(0, _SERVICES_PATH)

from pipeline import (  # noqa: E402
    run_pipeline_fast,
    run_pipeline_warm,
    to_scaffold_payload,
)

# ---------------------------------------------------------------------------
# Pricing source allowlist
# ---------------------------------------------------------------------------
_ENCOMPASS_HOSTS = frozenset(["encompass.com", "www.encompass.com"])
_DL_LOOKUP_HOSTS = frozenset(["dlpartscolookup.com", "www.dlpartscolookup.com"])


def _is_allowed_pricing_source(url: str | None) -> bool:
    if not url:
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    if host in _ENCOMPASS_HOSTS:
        return True
    return host in _DL_LOOKUP_HOSTS and parsed.path.startswith("/lookup")


def _quarantine_pricing(payload: dict) -> dict:
    """
    Move all price-like extraction fields into raw quarantine evidence.
    Approved-host metadata is retained only to inform the later pricing lane.
    Modifies payload in place; returns it.
    """
    price_fields = ("price", "list_price", "retail_price", "cost", "unit_price")
    for part in payload.get("canonical_bom_parts", []):
        source_url = part.get("source_url") or part.get("diagram_image_url", "")
        quarantined = {}
        for field in price_fields:
            if field in part:
                quarantined[field] = part.pop(field)
        if quarantined:
            quarantined["_source_url"] = source_url
            quarantined["_approved_pricing_source"] = _is_allowed_pricing_source(source_url)
            part["_quarantined_pricing"] = quarantined
    return payload


def _build_warnings(payload: dict) -> list[str]:
    warnings = []
    expected = payload.get("expected_parts_count") or 0
    found = payload.get("parts_found") or 0
    count_meta = payload.get("expected_count_meta") or {}
    source_range = count_meta.get("credible_source_range") or {}
    minimum = source_range.get("minimum")
    maximum = source_range.get("maximum")

    if minimum and maximum and minimum != maximum:
        warnings.append(
            f"Exact-model source totals disagree ({minimum}-{maximum}); "
            f"using {expected} as the coverage target."
        )
    rejected = count_meta.get("rejected_expected_parts_count")
    if rejected:
        warnings.append(
            f"Ignored implausible expected count {rejected}; diagram reference "
            "labels are not part totals."
        )
    if expected > 0 and found < expected:
        warnings.append(
            f"Partial extraction: found {found} of {expected} expected parts."
        )
    elif expected == 0:
        warnings.append(
            "No credible exact-model expected part total was established."
        )
    return warnings


# ---------------------------------------------------------------------------
# Request validation
# ---------------------------------------------------------------------------
_VALID_MODES = frozenset(["fast", "warm"])


def _validate_body(body: dict) -> str | None:
    """Return an error string if validation fails, else None."""
    if not body.get("job_id"):
        return "job_id is required"
    if not body.get("model_number"):
        return "model_number is required"
    mode = body.get("mode", "fast")
    if mode not in _VALID_MODES:
        return f"mode must be one of {sorted(_VALID_MODES)}"
    return None


# ---------------------------------------------------------------------------
# Vercel serverless handler
# ---------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # suppress default access log noise
        pass

    def _send_json(self, status: int, body: dict) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:
        # ------------------------------------------------------------------ read body
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            body = json.loads(raw)
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"error": f"invalid JSON body: {exc}"})
            return

        # ------------------------------------------------------------------ validate
        err = _validate_body(body)
        if err:
            self._send_json(400, {"error": err})
            return

        job_id: str = body["job_id"]
        model_number: str = body["model_number"]
        mode: str = body.get("mode", "fast")

        nameplate_kwargs = {
            "model_number": model_number,
            "serial": body.get("serial"),
            "brand": body.get("brand"),
            "appliance_type": body.get("appliance_type"),
            "expected_count_info": body.get("expected_count_info"),
        }

        # ------------------------------------------------------------------ run pipeline
        try:
            started_at = time.perf_counter()
            if mode == "warm":
                results = run_pipeline_warm(**nameplate_kwargs)
            else:
                results = run_pipeline_fast(**nameplate_kwargs)
        except Exception as exc:
            tb = traceback.format_exc()
            self._send_json(500, {
                "job_id": job_id,
                "status": "failed",
                "error": "pipeline execution failed",
                "detail": str(exc),
                "traceback": tb,
            })
            return

        # ------------------------------------------------------------------ build payload
        try:
            payload = to_scaffold_payload(results, job_id)
        except Exception as exc:
            self._send_json(500, {
                "job_id": job_id,
                "status": "failed",
                "error": "payload mapping failed",
                "detail": str(exc),
            })
            return

        # ------------------------------------------------------------------ quarantine pricing
        _quarantine_pricing(payload)

        expected = payload.get("expected_parts_count") or 0
        found = payload.get("parts_found") or 0
        is_partial = expected > 0 and found < expected
        payload["status"] = "partial" if is_partial else "ok"
        payload["extraction_run"] = {
            "adapter_name": "python_gemini_pipeline",
            "adapter_version": "1",
            "mode": mode,
            "latency_ms": max(0, round((time.perf_counter() - started_at) * 1000)),
        }
        payload["warnings"] = _build_warnings(payload)

        # ------------------------------------------------------------------ return
        self._send_json(200, payload)

    def do_GET(self) -> None:
        self._send_json(405, {"error": "method not allowed — use POST"})
