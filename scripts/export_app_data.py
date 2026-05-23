"""Export Phase 1 SQL view results as static JSON for the Phase 2 app.

This is a local build-time bridge. The browser app does not connect directly to
PostgreSQL, and this script does not need API keys.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
APP_DATA_DIR = PROJECT_ROOT / "app" / "public" / "data"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, separator, value = line.partition("=")
        if separator and key.strip():
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv(ENV_PATH)

POSTGRES_DB = os.environ.get("POSTGRES_DB", "shelter_signal")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "shelter_signal")
POSTGRES_SERVICE = os.environ.get("POSTGRES_SERVICE", "postgres")


EXPORTS = {
    "animals.json": """
        SELECT COALESCE(
            jsonb_agg(
                to_jsonb(export_rows) - 'sort_order'
                ORDER BY sort_order, days_until_notice_end, desertion_no
            ),
            '[]'::jsonb
        )
        FROM (
            SELECT
                desertion_no,
                notice_no,
                happen_dt,
                happen_place,
                notice_sdt,
                notice_edt,
                days_until_notice_end,
                deadline_bucket,
                rescue_window_score,
                rescue_window_label,
                kind_full_nm,
                up_kind_nm,
                kind_nm,
                color_cd,
                age,
                weight,
                popfile1,
                popfile2,
                process_state,
                sex_cd,
                neuter_yn,
                special_mark,
                care_nm,
                care_tel,
                care_addr,
                org_nm,
                has_photo,
                has_care_tel,
                CASE rescue_window_label
                    WHEN '긴급 확인' THEN 1
                    WHEN '곧 종료' THEN 2
                    WHEN '확인 필요' THEN 3
                    WHEN '여유 있음' THEN 4
                    ELSE 5
                END AS sort_order
            FROM mart.animals_clean
        ) AS export_rows;
    """,
    "region_summary.json": """
        SELECT COALESCE(
            jsonb_agg(to_jsonb(region_summary) ORDER BY urgent_count DESC, ending_soon_count DESC, animal_count DESC, org_nm),
            '[]'::jsonb
        )
        FROM mart.region_summary;
    """,
    "rescue_window_summary.json": """
        SELECT COALESCE(
            jsonb_agg(to_jsonb(rescue_window_summary)),
            '[]'::jsonb
        )
        FROM mart.rescue_window_summary;
    """,
    "shelter_summary.json": """
        SELECT COALESCE(
            jsonb_agg(to_jsonb(shelter_summary) ORDER BY urgent_count DESC, missing_care_tel_count DESC, animal_count DESC, care_nm),
            '[]'::jsonb
        )
        FROM mart.shelter_summary;
    """,
    "kind_summary.json": """
        SELECT COALESCE(
            jsonb_agg(to_jsonb(kind_summary) ORDER BY high_priority_count DESC, animal_count DESC, up_kind_nm, kind_nm),
            '[]'::jsonb
        )
        FROM mart.kind_summary;
    """,
}


def run_command(command: list[str], *, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        input=input_text,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        cwd=PROJECT_ROOT,
        check=False,
    )


def psql_json(sql: str) -> Any:
    command = [
        "docker",
        "compose",
        "exec",
        "-T",
        POSTGRES_SERVICE,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        POSTGRES_USER,
        "-d",
        POSTGRES_DB,
        "-At",
    ]
    result = run_command(command, input_text=sql)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "psql export failed")

    payload = result.stdout.strip()
    if not payload:
        return []
    return json.loads(payload)


def check_postgres() -> None:
    print("Checking local PostgreSQL connection...")
    result = run_command(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            POSTGRES_SERVICE,
            "pg_isready",
            "-U",
            POSTGRES_USER,
            "-d",
            POSTGRES_DB,
        ]
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "PostgreSQL is not ready.")
    print("PASS PostgreSQL is ready.")


def write_json(path: Path, data: Any) -> int:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(data) if isinstance(data, list) else 1


def main() -> int:
    print("Exporting Shelter Signal app data...")
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

    try:
        check_postgres()
        for filename, sql in EXPORTS.items():
            data = psql_json(sql)
            output_path = APP_DATA_DIR / filename
            row_count = write_json(output_path, data)
            print(f"PASS wrote {output_path.relative_to(PROJECT_ROOT)} ({row_count} rows)")
    except Exception as exc:
        print(f"FAIL export failed: {exc}", file=sys.stderr)
        return 1

    print("PASS app data export complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
