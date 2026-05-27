"""Run a local dry-run for the Shelter Signal V2 daily email digest.

This command verifies the local PostgreSQL alert candidate view, exports the
preview JSON/HTML files, and confirms the files exist. It never sends email,
does not need API keys, and does not include recipients.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import export_email_digest as digest_export


ALERT_CANDIDATES_EXISTS_SQL = """
    SELECT to_jsonb(
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class AS relation
            JOIN pg_catalog.pg_namespace AS namespace
                ON namespace.oid = relation.relnamespace
            WHERE namespace.nspname = 'mart'
                AND relation.relname = 'alert_candidates'
                AND relation.relkind IN ('r', 'v', 'm', 'p')
        )
    );
"""

ALERT_CANDIDATES_COUNT_SQL = """
    SELECT to_jsonb(COUNT(*))
    FROM mart.alert_candidates;
"""


def relative_path(path: Path) -> str:
    return path.relative_to(digest_export.PROJECT_ROOT).as_posix()


def check_alert_candidates_exists() -> bool:
    return bool(digest_export.psql_json(ALERT_CANDIDATES_EXISTS_SQL))


def count_alert_candidates() -> int:
    count = digest_export.psql_json(ALERT_CANDIDATES_COUNT_SQL)
    try:
        return int(count)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("alert candidate count query did not return an integer") from exc


def export_preview_files() -> int:
    digest_export.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    candidates = digest_export.psql_json(digest_export.ALERT_CANDIDATES_SQL)
    if not isinstance(candidates, list):
        raise RuntimeError("alert_candidates export query did not return a JSON list")

    digest = digest_export.build_digest(candidates)
    digest_export.write_json(digest_export.JSON_OUTPUT, digest)
    digest_export.write_text(digest_export.HTML_OUTPUT, digest_export.build_html(digest))
    return len(candidates)


def verify_output_file(path: Path) -> None:
    if not path.is_file():
        raise RuntimeError(f"expected output file was not created: {relative_path(path)}")
    if path.stat().st_size == 0:
        raise RuntimeError(f"expected output file is empty: {relative_path(path)}")


def run_dry_run() -> dict[str, Any]:
    db_status = "FAIL"
    model_status = "not checked"
    json_status = "not verified"
    html_status = "not verified"
    candidate_count: int | None = None
    preview_count: int | None = None
    error_message = ""

    try:
        digest_export.check_postgres()
        db_status = "PASS"

        if not check_alert_candidates_exists():
            model_status = "FAIL"
            raise RuntimeError("mart.alert_candidates model/view does not exist")
        model_status = "PASS"

        candidate_count = count_alert_candidates()
        print(f"PASS mart.alert_candidates exists ({candidate_count} candidates).")

        preview_count = export_preview_files()
        verify_output_file(digest_export.JSON_OUTPUT)
        json_status = f"PASS {relative_path(digest_export.JSON_OUTPUT)}"
        verify_output_file(digest_export.HTML_OUTPUT)
        html_status = f"PASS {relative_path(digest_export.HTML_OUTPUT)}"
    except Exception as exc:
        error_message = str(exc)

    dry_run_result = {
        "result": "FAIL" if error_message else "PASS",
        "db_connection_status": db_status,
        "alert_candidates_status": model_status,
        "preview_rows_exported": preview_count,
        "json_export_status": json_status,
        "html_export_status": html_status,
    }

    return {
        "status": "error" if error_message else "ok",
        "dry_run_result": dry_run_result,
        "alert_candidate_count": candidate_count,
        "json_export_path": relative_path(digest_export.JSON_OUTPUT),
        "html_export_path": relative_path(digest_export.HTML_OUTPUT),
        "message": error_message or "PASS daily digest preview dry-run complete. No email was sent.",
    }


def main() -> int:
    print("Running Shelter Signal V2 daily digest dry-run...")
    print("No email will be sent. No recipients or email credentials are required.")

    result = run_dry_run()
    dry_run_result = result["dry_run_result"]

    print("\nDaily digest dry-run summary:")
    print(f"  DB connection status: {dry_run_result['db_connection_status']}")
    print(f"  alert_candidates status: {dry_run_result['alert_candidates_status']}")
    print(
        "  alert candidate count: "
        f"{result['alert_candidate_count'] if result['alert_candidate_count'] is not None else '-'}"
    )
    if dry_run_result["preview_rows_exported"] is not None:
        print(f"  preview rows exported: {dry_run_result['preview_rows_exported']}")
    print(f"  JSON export path: {dry_run_result['json_export_status']}")
    print(f"  HTML export path: {dry_run_result['html_export_status']}")

    if result["status"] == "error":
        print(f"  Result: FAIL - {result['message']}")
        return 1

    print("  Result: PASS")
    print(result["message"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
