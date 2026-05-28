"""Generate the V2 digest preview, send it to Mailpit, and verify capture.

This is a local-only smoke test. It sends one HTML message to Mailpit's local
SMTP port and verifies the message through Mailpit's web API. It never uses
Gmail, OAuth, app passwords, real recipients, or production email delivery.
"""

from __future__ import annotations

import json
import smtplib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path
from typing import Any

import run_daily_digest_dry_run


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAILPIT_BASE_URL = "http://localhost:8025"
MAILPIT_MESSAGES_URL = f"{MAILPIT_BASE_URL}/api/v1/messages"
SMTP_HOST = "localhost"
SMTP_PORT = 1025
FROM_EMAIL = "shelter-signal@test.local"
TO_EMAIL = "test-recipient@example.local"
SUBJECT = "[TEST] Shelter Signal Daily Digest"
HTML_OUTPUT = PROJECT_ROOT / "data" / "exports" / "email_digest_preview.html"
STARTUP_COMMANDS = [
    r"cd C:\Users\msi\OneDrive\문서\GitHub\shelter-signal",
    "git checkout v2/n8n-email-alerts",
    "git pull",
    '$env:POSTGRES_PORT="5433"',
    "docker compose up -d",
]


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


class SmokeTestFailure(RuntimeError):
    """Expected smoke-test failure with a user-facing message."""


def print_startup_help() -> None:
    print("Mailpit is not reachable at http://localhost:8025.")
    print("Start the local services first:")
    for command in STARTUP_COMMANDS:
        print(f"  {command}")


def http_get(url: str, *, accept_json: bool = False, timeout: float = 5.0) -> Any:
    request = urllib.request.Request(url, headers={"Accept": "application/json" if accept_json else "*/*"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
        if accept_json:
            return json.loads(payload.decode("utf-8"))
        return payload.decode("utf-8", errors="replace")


def wait_for_mailpit() -> None:
    last_error = ""
    for _ in range(20):
        try:
            http_get(MAILPIT_MESSAGES_URL, accept_json=True, timeout=2.0)
            return
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            time.sleep(0.5)

    print_startup_help()
    raise SmokeTestFailure(f"Mailpit API check failed: {last_error or 'unknown error'}")


def list_messages() -> list[dict[str, Any]]:
    payload = http_get(MAILPIT_MESSAGES_URL, accept_json=True)
    if isinstance(payload, dict):
        messages = payload.get("messages") or payload.get("Messages") or []
    elif isinstance(payload, list):
        messages = payload
    else:
        messages = []

    if not isinstance(messages, list):
        raise SmokeTestFailure("Mailpit /api/v1/messages returned an unexpected shape.")
    return [message for message in messages if isinstance(message, dict)]


def message_id(message: dict[str, Any]) -> str:
    for key in ("ID", "Id", "id"):
        value = message.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def run_digest_dry_run() -> dict[str, Any]:
    result = run_daily_digest_dry_run.run_dry_run()
    if result.get("status") != "ok":
        message = str(result.get("message") or "daily digest dry-run failed")
        raise SmokeTestFailure(
            "\n".join(
                [
                    f"Daily digest dry-run failed: {message}",
                    "Database prerequisites may be missing.",
                    "Run:",
                    "  docker compose up -d",
                    "  python scripts/validate_pipeline.py",
                    "Then retry:",
                    "  python scripts/run_v2_mailpit_email_capture_test.py",
                ]
            )
        )
    return result


def read_digest_html() -> str:
    if not HTML_OUTPUT.is_file():
        raise SmokeTestFailure(f"HTML export was not created: {HTML_OUTPUT.relative_to(PROJECT_ROOT)}")
    html = HTML_OUTPUT.read_text(encoding="utf-8")
    if not html.strip():
        raise SmokeTestFailure(f"HTML export is empty: {HTML_OUTPUT.relative_to(PROJECT_ROOT)}")
    if "Shelter Signal" not in html:
        raise SmokeTestFailure("HTML export does not contain 'Shelter Signal'.")
    return html


def send_to_mailpit(html: str) -> str:
    message = EmailMessage()
    message_id_value = make_msgid(domain="test.local")
    message["From"] = FROM_EMAIL
    message["To"] = TO_EMAIL
    message["Subject"] = SUBJECT
    message["Message-ID"] = message_id_value
    message["X-Shelter-Signal-Test"] = "mailpit-capture-smoke-test"
    message.set_content("Shelter Signal V2 Mailpit capture smoke test.")
    message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.send_message(message)
    except OSError as exc:
        raise SmokeTestFailure(
            f"SMTP send to Mailpit failed: {exc}. Is Mailpit running on localhost:1025?"
        ) from exc

    return message_id_value.strip("<>")


def normalize_address_values(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value.lower()]
    if isinstance(value, dict):
        addresses: list[str] = []
        for key in ("Address", "address", "Email", "email", "Mailbox", "mailbox"):
            nested = value.get(key)
            if isinstance(nested, str):
                addresses.append(nested.lower())
        for nested in value.values():
            addresses.extend(normalize_address_values(nested))
        return addresses
    if isinstance(value, list):
        addresses = []
        for item in value:
            addresses.extend(normalize_address_values(item))
        return addresses
    return []


def message_matches_summary(message: dict[str, Any], new_ids: set[str]) -> bool:
    msg_id = message_id(message)
    if msg_id and msg_id not in new_ids:
        return False

    subject = str(message.get("Subject") or message.get("subject") or "")
    if SUBJECT not in subject:
        return False

    from_values = normalize_address_values(message.get("From") or message.get("from"))
    to_values = normalize_address_values(message.get("To") or message.get("to"))
    return FROM_EMAIL.lower() in from_values and TO_EMAIL.lower() in to_values


def fetch_message_detail(message: dict[str, Any]) -> dict[str, Any]:
    msg_id = message_id(message)
    if not msg_id:
        return message

    encoded_id = urllib.parse.quote(msg_id, safe="")
    for path in (f"/api/v1/message/{encoded_id}", f"/api/v1/messages/{encoded_id}"):
        try:
            payload = http_get(f"{MAILPIT_BASE_URL}{path}", accept_json=True)
        except (OSError, urllib.error.URLError, json.JSONDecodeError):
            continue
        if isinstance(payload, dict):
            return payload
    return message


def extract_html_from_detail(message: dict[str, Any]) -> str:
    for key in ("HTML", "Html", "html", "HTMLBody", "htmlBody"):
        value = message.get(key)
        if isinstance(value, str) and value.strip():
            return value

    msg_id = message_id(message)
    if msg_id:
        encoded_id = urllib.parse.quote(msg_id, safe="")
        for path in (f"/api/v1/message/{encoded_id}/html", f"/api/v1/messages/{encoded_id}/html"):
            try:
                html = http_get(f"{MAILPIT_BASE_URL}{path}", accept_json=False)
            except (OSError, urllib.error.URLError):
                continue
            if html.strip():
                return html
    return ""


def verify_captured_message(before_ids: set[str], expected_message_id: str) -> dict[str, Any]:
    deadline = time.time() + 15
    last_messages: list[dict[str, Any]] = []

    while time.time() < deadline:
        messages = list_messages()
        last_messages = messages
        current_ids = {message_id(message) for message in messages if message_id(message)}
        new_ids = current_ids - before_ids

        candidates = [message for message in messages if message_matches_summary(message, new_ids)]
        if not candidates and expected_message_id:
            candidates = [
                message
                for message in messages
                if expected_message_id in str(message.get("MessageID") or message.get("MessageId") or "")
            ]

        for candidate in candidates:
            detail = fetch_message_detail(candidate)
            merged = {**candidate, **detail}
            html = extract_html_from_detail(merged)
            if html.strip() and "Shelter Signal" in html:
                merged["_verified_html"] = html
                return merged
        time.sleep(0.5)

    raise SmokeTestFailure(
        f"Mailpit inbox verification failed. Checked {len(last_messages)} messages but did not find the test email."
    )


def print_summary(checks: list[Check]) -> None:
    print("\nShelter Signal V2 Mailpit email capture smoke test summary:")
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"  {status} {check.name}: {check.detail}")


def main() -> int:
    checks: list[Check] = []

    try:
        wait_for_mailpit()
        before_messages = list_messages()
        before_ids = {message_id(message) for message in before_messages if message_id(message)}
        checks.append(Check("Mailpit API", True, MAILPIT_MESSAGES_URL))

        dry_run_result = run_digest_dry_run()
        dry_run_summary = dry_run_result.get("dry_run_result", {})
        checks.append(Check("dry-run", True, str(dry_run_summary.get("result") or "PASS")))

        html = read_digest_html()
        checks.append(Check("HTML export", True, HTML_OUTPUT.relative_to(PROJECT_ROOT).as_posix()))

        expected_message_id = send_to_mailpit(html)
        checks.append(Check("SMTP send", True, f"{FROM_EMAIL} -> {TO_EMAIL} via {SMTP_HOST}:{SMTP_PORT}"))

        captured = verify_captured_message(before_ids, expected_message_id)
        captured_subject = str(captured.get("Subject") or captured.get("subject") or "")
        captured_from = normalize_address_values(captured.get("From") or captured.get("from"))
        captured_to = normalize_address_values(captured.get("To") or captured.get("to"))
        captured_html = str(captured.get("_verified_html") or "")

        checks.append(Check("Mailpit subject", SUBJECT in captured_subject, captured_subject or "-"))
        checks.append(Check("Mailpit sender", FROM_EMAIL.lower() in captured_from, FROM_EMAIL))
        checks.append(Check("Mailpit recipient", TO_EMAIL.lower() in captured_to, TO_EMAIL))
        checks.append(Check("Mailpit HTML content", bool(captured_html.strip()), "HTML body exists"))
        checks.append(Check("Mailpit HTML text", "Shelter Signal" in captured_html, "contains Shelter Signal"))

        failed_checks = [check for check in checks if not check.passed]
        if failed_checks:
            raise SmokeTestFailure("Mailpit inbox verification failed.")
    except SmokeTestFailure as exc:
        checks.append(Check("smoke test", False, str(exc)))
        print_summary(checks)
        return 1
    except Exception as exc:
        checks.append(Check("unexpected error", False, str(exc)))
        print_summary(checks)
        return 1

    print_summary(checks)
    print("\nPASS Mailpit captured the Shelter Signal test email.")
    print("Open http://localhost:8025 to inspect the rendered message.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
