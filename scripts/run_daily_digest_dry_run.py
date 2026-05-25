"""Run a local dry-run for the Shelter Signal V2 daily email digest.

This command verifies the local PostgreSQL alert candidate view, exports the
preview JSON/HTML files, and confirms the files exist. It never sends email,
does not need API keys, and does not include recipients.
"""

from __future__ import annotations

from pathlib import Path

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
    return str(path.relative_to(digest_export.PROJECT_ROOT))


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


def main() -> int:
    print("Running Shelter Signal V2 daily digest dry-run...")
    print("No email will be sent. No recipients or email credentials are required.")

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

    print("\nDaily digest dry-run summary:")
    print(f"  DB connection status: {db_status}")
    print(f"  alert_candidates status: {model_status}")
    print(f"  alert candidate count: {candidate_count if candidate_count is not None else '-'}")
    if preview_count is not None:
        print(f"  preview rows exported: {preview_count}")
    print(f"  JSON export path: {json_status}")
    print(f"  HTML export path: {html_status}")

    if error_message:
        print(f"  Result: FAIL - {error_message}")
        return 1

    print("  Result: PASS")
    print("PASS daily digest preview dry-run complete. No email was sent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
