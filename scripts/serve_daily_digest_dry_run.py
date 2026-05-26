"""Local HTTP bridge for the Shelter Signal V2 daily digest dry-run.

This server is for local n8n development only. It exposes a small HTTP API so
an n8n HTTP Request node can trigger the existing preview dry-run when the
Execute Command node is unavailable. It never sends email, never needs
recipients, and never requires email credentials or API keys.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import export_email_digest as digest_export
import run_daily_digest_dry_run as dry_run


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
SERVICE_NAME = "shelter-signal-v2-daily-digest-dry-run-bridge"
TRUE_VALUES = {"1", "true", "yes", "on"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def json_bytes(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


class DryRunRequestHandler(BaseHTTPRequestHandler):
    server_version = "ShelterSignalDryRunBridge/1.0"

    def do_GET(self) -> None:
        parsed_url = self.parse_request_target()
        if parsed_url.path == "/health":
            self.respond_json(
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "service": SERVICE_NAME,
                    "message": "Local dry-run bridge is running. No email will be sent.",
                    "dry_run_url": f"http://{self.server.server_address[0]}:{self.server.server_address[1]}/dry-run",
                    "time": utc_now(),
                },
            )
            return

        self.respond_json(
            HTTPStatus.NOT_FOUND,
            {
                "status": "error",
                "message": "Not found. Available endpoints: GET /health, POST /dry-run.",
            },
        )

    def do_POST(self) -> None:
        parsed_url = self.parse_request_target()
        if parsed_url.path != "/dry-run":
            self.discard_request_body()
            self.log_local(f"Unknown POST target: {self.path}")
            self.respond_json(
                HTTPStatus.NOT_FOUND,
                {
                    "status": "error",
                    "message": "Not found. Use POST /dry-run to execute the local preview dry-run.",
                },
            )
            return

        try:
            request_body = self.read_json_body()
        except ValueError as exc:
            self.respond_json(
                HTTPStatus.BAD_REQUEST,
                {
                    "status": "error",
                    "message": str(exc),
                },
            )
            return

        include_html = self.include_html_requested(parsed_url.query, request_body)
        include_note = " with email_html payload" if include_html else ""
        self.log_local(
            f"POST /dry-run received{include_note}. Running preview dry-run; no email will be sent."
        )

        try:
            payload = dry_run.run_dry_run()
            status = HTTPStatus.OK if payload["status"] == "ok" else HTTPStatus.INTERNAL_SERVER_ERROR
            if include_html and status == HTTPStatus.OK:
                self.attach_email_html(payload)
        except Exception as exc:  # Defensive fallback for unexpected bridge errors.
            payload = {
                "status": "error",
                "dry_run_result": {
                    "result": "FAIL",
                    "db_connection_status": "unknown",
                    "alert_candidates_status": "unknown",
                    "preview_rows_exported": None,
                    "json_export_status": "not verified",
                    "html_export_status": "not verified",
                },
                "alert_candidate_count": None,
                "json_export_path": dry_run.relative_path(digest_export.JSON_OUTPUT),
                "html_export_path": dry_run.relative_path(digest_export.HTML_OUTPUT),
                "message": f"HTTP bridge failed while processing the dry-run request: {exc}",
            }
            status = HTTPStatus.INTERNAL_SERVER_ERROR

        self.log_local(
            f"POST /dry-run completed with {status.value}; result={payload['dry_run_result']['result']}"
        )
        self.respond_json(status, payload)

    def parse_request_target(self):
        return urlparse(unquote(self.path))

    def do_PUT(self) -> None:
        self.method_not_allowed()

    def do_PATCH(self) -> None:
        self.method_not_allowed()

    def do_DELETE(self) -> None:
        self.method_not_allowed()

    def discard_request_body(self) -> None:
        content_length = self.headers.get("Content-Length")
        if not content_length:
            return
        try:
            length = int(content_length)
        except ValueError:
            return
        if length > 0:
            self.rfile.read(length)

    def read_json_body(self) -> dict[str, Any]:
        content_length = self.headers.get("Content-Length")
        if not content_length:
            return {}
        try:
            length = int(content_length)
        except ValueError as exc:
            raise ValueError("Invalid Content-Length header.") from exc
        if length <= 0:
            return {}

        raw_body = self.rfile.read(length)
        if not raw_body.strip():
            return {}

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Request body must be valid JSON when provided.") from exc

        if not isinstance(payload, dict):
            raise ValueError("Request JSON body must be an object.")
        return payload

    def include_html_requested(self, query: str, request_body: dict[str, Any]) -> bool:
        query_values = parse_qs(query).get("include_html", [])
        if any(self.truthy(value) for value in query_values):
            return True
        return self.truthy(request_body.get("include_html"))

    def truthy(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            return value == 1
        if isinstance(value, str):
            return value.strip().lower() in TRUE_VALUES
        return False

    def attach_email_html(self, payload: dict[str, Any]) -> None:
        html_path = digest_export.HTML_OUTPUT
        if not html_path.is_file():
            raise RuntimeError(f"include_html requested, but {dry_run.relative_path(html_path)} does not exist.")
        if html_path.stat().st_size == 0:
            raise RuntimeError(f"include_html requested, but {dry_run.relative_path(html_path)} is empty.")
        payload["email_html"] = html_path.read_text(encoding="utf-8")

    def method_not_allowed(self) -> None:
        self.respond_json(
            HTTPStatus.METHOD_NOT_ALLOWED,
            {
                "status": "error",
                "message": "Method not allowed. Available endpoints: GET /health, POST /dry-run.",
            },
        )

    def respond_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json_bytes(payload)
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string: str, *args: Any) -> None:
        self.log_local(format_string % args)

    def log_local(self, message: str) -> None:
        print(f"[{utc_now()}] {self.client_address[0]} {message}", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve Shelter Signal V2 dry-run over local HTTP.")
    parser.add_argument(
        "--host",
        default=os.environ.get("SHELTER_SIGNAL_DRY_RUN_HOST", DEFAULT_HOST),
        help="Host to bind. Defaults to 127.0.0.1 for local-only access.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("SHELTER_SIGNAL_DRY_RUN_PORT", DEFAULT_PORT)),
        help="Port to bind. Defaults to 8787.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), DryRunRequestHandler)

    print("Starting Shelter Signal V2 local dry-run HTTP bridge.", flush=True)
    print("Local development only. No email will be sent.", flush=True)
    print(f"Health:  http://{args.host}:{args.port}/health", flush=True)
    print(f"Dry-run: POST http://{args.host}:{args.port}/dry-run", flush=True)
    print("Press Ctrl+C to stop.", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local dry-run HTTP bridge.", flush=True)
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
