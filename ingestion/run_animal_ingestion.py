"""Load rescued animal API records into the Phase 1 raw table.

Default behavior is a safe dry-run. Use --load-db to write to PostgreSQL.
The real API key must stay in local .env as ANIMAL_API_KEY and is never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen


BASE_URL = "https://apis.data.go.kr/1543061/abandonmentPublicService_v2/abandonmentPublic_v2"
DEFAULT_PAGE_NO = 1
DEFAULT_NUM_OF_ROWS = 10
RESPONSE_TYPE = "json"
TIMEOUT_SECONDS = 30

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
MOCK_DATA_PATH = PROJECT_ROOT / "data" / "sample" / "rescued_animals_mock.json"

POSTGRES_DB = os.environ.get("POSTGRES_DB", "shelter_signal")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "shelter_signal")
POSTGRES_SERVICE = os.environ.get("POSTGRES_SERVICE", "postgres")

DB_COLUMNS = [
    "source",
    "desertion_no",
    "notice_no",
    "happen_dt",
    "happen_place",
    "notice_sdt",
    "notice_edt",
    "kind_full_nm",
    "up_kind_nm",
    "up_kind_nm_raw",
    "kind_cd",
    "kind_nm",
    "color_cd",
    "age",
    "weight",
    "popfile1",
    "popfile2",
    "process_state",
    "sex_cd",
    "neuter_yn",
    "special_mark",
    "care_reg_no",
    "care_nm",
    "care_tel",
    "care_addr",
    "care_owner_nm",
    "org_nm",
    "etc_bigo",
    "upd_tm",
    "collected_at",
    "raw_json",
]

API_TO_DB = {
    "desertionNo": "desertion_no",
    "noticeNo": "notice_no",
    "happenDt": "happen_dt",
    "happenPlace": "happen_place",
    "noticeSdt": "notice_sdt",
    "noticeEdt": "notice_edt",
    "kindFullNm": "kind_full_nm",
    "upKindNm": "up_kind_nm",
    "kindCd": "kind_cd",
    "kindNm": "kind_nm",
    "colorCd": "color_cd",
    "age": "age",
    "weight": "weight",
    "popfile1": "popfile1",
    "popfile2": "popfile2",
    "processState": "process_state",
    "sexCd": "sex_cd",
    "neuterYn": "neuter_yn",
    "specialMark": "special_mark",
    "careRegNo": "care_reg_no",
    "careNm": "care_nm",
    "careTel": "care_tel",
    "careAddr": "care_addr",
    "careOwnerNm": "care_owner_nm",
    "orgNm": "org_nm",
    "etcBigo": "etc_bigo",
    "updTm": "upd_tm",
}


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, separator, value = line.partition("=")
        if not separator:
            continue
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
            os.environ.setdefault(key, value)
    return values


def get_api_key() -> str:
    env_values = load_dotenv(ENV_PATH)
    api_key = env_values.get("ANIMAL_API_KEY") or os.environ.get("ANIMAL_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise RuntimeError(
            "ANIMAL_API_KEY was not found. Use --mock for local mock data, "
            "or create a local .env file from .env.example."
        )
    return api_key


def encode_service_key(api_key: str) -> str:
    if "%" in api_key:
        return api_key
    return quote_plus(api_key, safe="")


def build_request_url(api_key: str, page_no: int, num_of_rows: int) -> str:
    if num_of_rows < 1 or num_of_rows > 10:
        raise ValueError("num_of_rows must be between 1 and 10 for Phase 1 ingestion.")

    query = urlencode(
        {
            "pageNo": str(page_no),
            "numOfRows": str(num_of_rows),
            "_type": RESPONSE_TYPE,
        }
    )
    return f"{BASE_URL}?serviceKey={encode_service_key(api_key)}&{query}"


def nested_get(data: Any, path: tuple[str, ...]) -> Any:
    current = data
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def extract_items(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    candidates = [
        nested_get(data, ("response", "body", "items", "item")),
        nested_get(data, ("body", "items", "item")),
        nested_get(data, ("items", "item")),
        nested_get(data, ("items",)),
    ]
    for candidate in candidates:
        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)]
        if isinstance(candidate, dict):
            return [candidate]
    return []


def fetch_live_records(page_no: int, num_of_rows: int) -> list[dict[str, Any]]:
    api_key = get_api_key()
    url = build_request_url(api_key, page_no, num_of_rows)
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "shelter-signal-ingestion/0.1",
        },
    )

    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            status_code = response.status
            body = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        raise RuntimeError(f"API returned HTTP {exc.code}; check endpoint and key status.") from exc
    except URLError as exc:
        raise RuntimeError(f"API request failed before a response was received: {exc}") from exc

    if not 200 <= status_code < 300:
        raise RuntimeError(f"API returned HTTP {status_code}; check endpoint and key status.")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"API did not return JSON. Parser message: {exc.msg}") from exc

    return extract_items(payload)


def load_mock_records(path: Path = MOCK_DATA_PATH) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return extract_items(payload)


def parse_api_date(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) == 8 and text.isdigit():
        return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
    return text


def parse_api_timestamp(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) == 14 and text.isdigit():
        return (
            f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
            f"T{text[8:10]}:{text[10:12]}:{text[12:14]}"
        )
    return text


def normalize_record(record: dict[str, Any], source: str, collected_at: str) -> dict[str, Any]:
    normalized = {column: None for column in DB_COLUMNS}
    normalized["source"] = source
    normalized["collected_at"] = collected_at
    normalized["raw_json"] = record

    for api_key, db_key in API_TO_DB.items():
        value = record.get(api_key)
        normalized[db_key] = value if value != "" else None

    normalized["up_kind_nm_raw"] = record.get("upKindNm")
    for date_key in ("happen_dt", "notice_sdt", "notice_edt"):
        normalized[date_key] = parse_api_date(normalized.get(date_key))
    normalized["upd_tm"] = parse_api_timestamp(normalized.get("upd_tm"))

    if normalized["desertion_no"] is not None:
        normalized["desertion_no"] = str(normalized["desertion_no"]).strip()

    return normalized


def normalize_records(records: list[dict[str, Any]], source: str) -> list[dict[str, Any]]:
    collected_at = datetime.now(timezone.utc).isoformat()
    return [normalize_record(record, source, collected_at) for record in records]


def find_safe_dollar_tag(payload: str) -> str:
    base = "json_payload"
    tag = base
    counter = 1
    while f"${tag}$" in payload:
        counter += 1
        tag = f"{base}_{counter}"
    return tag


def build_upsert_sql(rows: list[dict[str, Any]]) -> str:
    payload = json.dumps(rows, ensure_ascii=False)
    tag = find_safe_dollar_tag(payload)
    dollar_quote = f"${tag}$"
    column_list = ", ".join(DB_COLUMNS)
    select_list = ", ".join(DB_COLUMNS)
    update_list = ",\n        ".join(
        f"{column} = EXCLUDED.{column}"
        for column in DB_COLUMNS
        if column not in {"source", "desertion_no"}
    )

    recordset_columns = """
        source text,
        desertion_no text,
        notice_no text,
        happen_dt date,
        happen_place text,
        notice_sdt date,
        notice_edt date,
        kind_full_nm text,
        up_kind_nm text,
        up_kind_nm_raw text,
        kind_cd text,
        kind_nm text,
        color_cd text,
        age text,
        weight text,
        popfile1 text,
        popfile2 text,
        process_state text,
        sex_cd text,
        neuter_yn text,
        special_mark text,
        care_reg_no text,
        care_nm text,
        care_tel text,
        care_addr text,
        care_owner_nm text,
        org_nm text,
        etc_bigo text,
        upd_tm timestamptz,
        collected_at timestamptz,
        raw_json jsonb
    """

    return f"""
WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset({dollar_quote}{payload}{dollar_quote}::jsonb) AS rows (
{recordset_columns}
    )
),
upserted AS (
    INSERT INTO raw.rescued_animals ({column_list})
    SELECT {select_list}
    FROM incoming
    WHERE NULLIF(btrim(desertion_no), '') IS NOT NULL
    ON CONFLICT (source, desertion_no) DO UPDATE SET
        {update_list},
        updated_at = now()
    RETURNING 1
)
SELECT COUNT(*) FROM upserted;
"""


def run_psql(sql: str) -> subprocess.CompletedProcess[str]:
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
    return subprocess.run(
        command,
        input=sql,
        text=True,
        encoding="utf-8",
        capture_output=True,
        cwd=PROJECT_ROOT,
        check=False,
    )


def load_db(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0

    result = run_psql(build_upsert_sql(rows))
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "psql failed while loading records.")

    output = result.stdout.strip().splitlines()
    return int(output[-1]) if output else 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run rescued animal Phase 1 ingestion.")
    parser.add_argument("--mock", action="store_true", help="Load committed fictional mock data.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and normalize without writing.")
    parser.add_argument("--load-db", action="store_true", help="Upsert normalized rows into PostgreSQL.")
    parser.add_argument("--page-no", type=int, default=DEFAULT_PAGE_NO)
    parser.add_argument("--num-of-rows", type=int, default=DEFAULT_NUM_OF_ROWS)
    args = parser.parse_args()

    if args.dry_run and args.load_db:
        parser.error("--dry-run and --load-db cannot be used together.")
    return args


def main() -> int:
    args = parse_args()
    should_load_db = args.load_db
    dry_run = not should_load_db

    try:
        source = "mock" if args.mock else "animal_protection_api"
        api_records = (
            load_mock_records()
            if args.mock
            else fetch_live_records(args.page_no, args.num_of_rows)
        )
        rows = normalize_records(api_records, source)

        print(f"Source: {source}")
        print(f"Rows normalized: {len(rows)}")
        print(f"Mode: {'load-db' if should_load_db else 'dry-run'}")
        if rows:
            sample_keys = ", ".join(key for key in rows[0].keys() if key != "raw_json")
            print(f"Normalized columns: {sample_keys}")

        if dry_run:
            print("Dry-run complete; no database writes were made.")
            return 0

        upserted_count = load_db(rows)
        print(f"Rows upserted: {upserted_count}")
        return 0
    except Exception as exc:
        print(f"Ingestion failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
