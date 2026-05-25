"""Export a local preview of the Shelter Signal V2 email digest.

This script reads mart.alert_candidates from local PostgreSQL and writes
preview-only JSON/HTML files. It never sends email, does not need API keys, and
does not include recipients.
"""

from __future__ import annotations

import html
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
EXPORT_DIR = PROJECT_ROOT / "data" / "exports"
JSON_OUTPUT = EXPORT_DIR / "email_digest_preview.json"
HTML_OUTPUT = EXPORT_DIR / "email_digest_preview.html"

SUBJECT = "[Shelter Signal] 오늘 확인할 보호 종료 임박 공고"
INTRO_COPY = "오늘 확인할 보호 종료 임박 공고를 정리했어요."
SAFETY_COPY = "공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요."
PREVIEW_NOTE = "이 파일은 V2 계획 단계의 preview-only 산출물이며 실제 이메일을 발송하지 않습니다."

ALERT_CANDIDATES_SQL = """
    SELECT COALESCE(
        jsonb_agg(
            to_jsonb(alert_rows)
            ORDER BY
                alert_priority,
                days_until_notice_end ASC NULLS LAST,
                rescue_window_score DESC,
                desertion_no
        ),
        '[]'::jsonb
    )
    FROM (
        SELECT
            desertion_no,
            notice_no,
            kind_full_nm,
            up_kind_nm,
            kind_nm,
            notice_sdt,
            notice_edt,
            days_until_notice_end,
            rescue_window_score,
            rescue_window_label,
            process_state,
            care_nm,
            care_tel,
            care_addr,
            org_nm,
            happen_place,
            popfile1,
            alert_reason,
            alert_priority
        FROM mart.alert_candidates
        ORDER BY
            alert_priority,
            days_until_notice_end ASC NULLS LAST,
            rescue_window_score DESC,
            desertion_no
        LIMIT 20
    ) AS alert_rows;
"""


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
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "psql query failed")

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


def candidate_label(candidate: dict[str, Any]) -> str:
    kind = candidate.get("kind_full_nm") or candidate.get("kind_nm") or "품종 미상"
    region = candidate.get("org_nm") or "지역 미상"
    shelter = candidate.get("care_nm") or "보호소 미상"
    return f"{kind} · {region} · {shelter}"


def build_digest(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {
        "preview_only": True,
        "recipient": None,
        "subject": SUBJECT,
        "generated_at": generated_at,
        "candidate_count": len(candidates),
        "intro": INTRO_COPY,
        "safety_note": SAFETY_COPY,
        "preview_note": PREVIEW_NOTE,
        "source_view": "mart.alert_candidates",
        "candidates": candidates,
    }


def text_or_dash(value: Any) -> str:
    if value is None:
        return "-"
    text = str(value).strip()
    return text if text else "-"


def html_cell(value: Any) -> str:
    return html.escape(text_or_dash(value))


def build_html(digest: dict[str, Any]) -> str:
    candidates = digest["candidates"]
    if candidates:
        rows = "\n".join(
            f"""
            <tr>
              <td>{html_cell(candidate.get("alert_priority"))}</td>
              <td>{html_cell(candidate.get("alert_reason"))}</td>
              <td>{html_cell(candidate.get("rescue_window_label"))}</td>
              <td>{html_cell(candidate.get("days_until_notice_end"))}</td>
              <td>{html.escape(candidate_label(candidate))}</td>
              <td>{html_cell(candidate.get("notice_no"))}</td>
              <td>{html_cell(candidate.get("notice_edt"))}</td>
            </tr>
            """.strip()
            for candidate in candidates
        )
    else:
        rows = """
            <tr>
              <td colspan="7">오늘 preview에 포함할 알림 후보가 없습니다.</td>
            </tr>
        """.strip()

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>{html.escape(digest["subject"])}</title>
  <style>
    body {{
      margin: 0;
      padding: 24px;
      background: #f8f4ec;
      color: #1b2421;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
    }}
    main {{
      max-width: 760px;
      margin: 0 auto;
      padding: 24px;
      border: 1px solid #e2d8ca;
      border-radius: 8px;
      background: #fffdfa;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 14px;
    }}
    th, td {{
      padding: 10px 8px;
      border-bottom: 1px solid #e2d8ca;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      color: #46544f;
      font-size: 12px;
    }}
    .note {{
      color: #64716b;
      font-size: 14px;
    }}
  </style>
</head>
<body>
  <main>
    <p class="note">Shelter Signal V2 preview</p>
    <h1>{html.escape(digest["subject"])}</h1>
    <p>{html.escape(digest["intro"])}</p>
    <p>{html.escape(digest["safety_note"])}</p>
    <p class="note">{html.escape(digest["preview_note"])}</p>
    <table aria-label="Shelter Signal alert candidates">
      <thead>
        <tr>
          <th>우선순위</th>
          <th>선정 사유</th>
          <th>신호</th>
          <th>남은 일수</th>
          <th>공고</th>
          <th>공고번호</th>
          <th>보호 종료일</th>
        </tr>
      </thead>
      <tbody>
        {rows}
      </tbody>
    </table>
  </main>
</body>
</html>
"""


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def main() -> int:
    print("Exporting Shelter Signal V2 email digest preview...")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        check_postgres()
        candidates = psql_json(ALERT_CANDIDATES_SQL)
        if not isinstance(candidates, list):
            raise RuntimeError("alert_candidates query did not return a JSON list")

        digest = build_digest(candidates)
        write_json(JSON_OUTPUT, digest)
        write_text(HTML_OUTPUT, build_html(digest))

        print(f"PASS read mart.alert_candidates ({len(candidates)} candidates)")
        print(f"PASS wrote {JSON_OUTPUT.relative_to(PROJECT_ROOT)}")
        print(f"PASS wrote {HTML_OUTPUT.relative_to(PROJECT_ROOT)}")
        print("PASS preview export complete. No email was sent.")
    except Exception as exc:
        print(f"FAIL preview export failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
