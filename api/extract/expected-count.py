"""Resolve an exact-model BOM coverage target before extraction starts."""

from __future__ import annotations

import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler

_SERVICES_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "services",
    "extraction",
)
if _SERVICES_PATH not in sys.path:
    sys.path.insert(0, _SERVICES_PATH)

from pipeline import normalize_expected_count, step5_expected_count  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_json(self, status: int, body: dict) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            body = json.loads(raw)
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"error": f"invalid JSON body: {exc}"})
            return

        model_number = str(body.get("model_number") or "").strip()
        if not model_number:
            self._send_json(400, {"error": "model_number is required"})
            return

        try:
            raw_count_info = step5_expected_count({"model_number": model_number})
            expected, count_meta = normalize_expected_count(raw_count_info)
            if expected <= 0:
                raise RuntimeError(
                    f"No exact-model Sears or Encompass target found for {model_number}"
                )
        except Exception as exc:
            self._send_json(502, {
                "status": "failed",
                "error": "expected part count resolution failed",
                "detail": str(exc),
                "traceback": traceback.format_exc(),
            })
            return

        self._send_json(200, {
            "status": "ok",
            "model_number": model_number,
            "expected_parts_count": expected,
            "expected_count_info": raw_count_info,
            "expected_count_meta": count_meta,
        })

    def do_GET(self) -> None:
        self._send_json(405, {"error": "method not allowed - use POST"})
