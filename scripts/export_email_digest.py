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
SUBTITLE_COPY = "보호 종료가 가까운 공고를 먼저 확인합니다."
INTRO_COPY = "오늘 확인할 보호 종료 임박 공고를 정리했어요."
SAFETY_COPY = "공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요."
PREVIEW_NOTE = "이 파일은 V2 계획 단계의 preview-only 산출물이며 실제 이메일을 발송하지 않습니다."
HTML_FOOTER_NOTE = "이 메일은 Shelter Signal V2 알림 파이프라인 검증을 위한 미리보기입니다."

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


def html_text(value: Any) -> str:
    return html.escape(text_or_dash(value))


def as_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def d_day_text(candidate: dict[str, Any]) -> str:
    days = as_int(candidate.get("days_until_notice_end"))
    if days is None:
        return "확인"
    if days < 0:
        return "종료"
    if days == 0:
        return "D-day"
    return f"D-{days}"


def days_hint(candidate: dict[str, Any]) -> str:
    days = as_int(candidate.get("days_until_notice_end"))
    if days is None:
        return "종료일 확인 필요"
    if days < 0:
        return "공고 상태 확인 필요"
    if days == 0:
        return "오늘 보호 종료"
    return f"{days}일 남음"


def generated_at_text(digest: dict[str, Any]) -> str:
    generated_at = text_or_dash(digest.get("generated_at"))
    return generated_at.replace("T", " ").replace("+00:00", " UTC")


def count_label(candidates: list[dict[str, Any]], label: str) -> int:
    return sum(1 for candidate in candidates if candidate.get("rescue_window_label") == label)


def build_summary_cell(label: str, value: Any, accent_color: str) -> str:
    return f"""
      <td width="33.33%" style="padding:0 4px 8px 4px; vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #e2d8ca; background:#fffdfa;">
          <tr>
            <td style="padding:12px 12px 10px 12px;">
              <div style="font-size:12px; line-height:1.4; color:#64716b;">{html.escape(label)}</div>
              <div style="margin-top:4px; font-size:22px; line-height:1.2; font-weight:700; color:{accent_color};">{html_text(value)}</div>
            </td>
          </tr>
        </table>
      </td>
    """.strip()


def build_candidate_card(candidate: dict[str, Any], index: int) -> str:
    kind = candidate.get("kind_full_nm") or candidate.get("kind_nm") or "품종 미상"
    happen_place = candidate.get("happen_place") or "발견 장소 확인 필요"
    care_name = candidate.get("care_nm") or "보호소 확인 필요"
    care_tel = candidate.get("care_tel") or "전화번호 확인 필요"
    notice_end = candidate.get("notice_edt") or "보호 종료일 확인 필요"
    score = candidate.get("rescue_window_score")
    label = candidate.get("rescue_window_label") or "확인 필요"
    reason = candidate.get("alert_reason") or "우선 확인"

    return f"""
      <tr>
        <td style="padding:0 0 12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #e2d8ca; background:#fffdfa;">
            <tr>
              <td width="86" style="padding:16px 14px; vertical-align:top; background:#eef4ef; border-right:1px solid #d8e2d8;">
                <div style="font-size:24px; line-height:1.1; font-weight:800; color:#31584e;">{html.escape(d_day_text(candidate))}</div>
                <div style="margin-top:4px; font-size:12px; line-height:1.4; color:#46544f;">{html.escape(days_hint(candidate))}</div>
              </td>
              <td style="padding:16px 16px 14px 16px; vertical-align:top;">
                <div style="font-size:12px; line-height:1.4; color:#8a5d3b; font-weight:700;">공고 {index}</div>
                <div style="margin-top:4px; font-size:18px; line-height:1.35; font-weight:700; color:#1b2421;">{html_text(kind)}</div>
                <div style="margin-top:8px; font-size:13px; line-height:1.5; color:#46544f;">
                  <span style="display:inline-block; padding:3px 8px; border:1px solid #d3c7b8; background:#f5ead8; color:#72552d;">{html_text(label)}</span>
                  <span style="display:inline-block; padding:3px 8px; border:1px solid #d8e2d8; background:#eef4ef; color:#31584e;">Score {html_text(score)}</span>
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px; border-collapse:collapse;">
                  <tr>
                    <td style="padding:6px 0; font-size:12px; line-height:1.5; color:#64716b; width:84px;">선정 사유</td>
                    <td style="padding:6px 0; font-size:13px; line-height:1.5; color:#1b2421;">{html_text(reason)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; font-size:12px; line-height:1.5; color:#64716b;">발견 장소</td>
                    <td style="padding:6px 0; font-size:13px; line-height:1.5; color:#1b2421;">{html_text(happen_place)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; font-size:12px; line-height:1.5; color:#64716b;">보호소</td>
                    <td style="padding:6px 0; font-size:13px; line-height:1.5; color:#1b2421;">{html_text(care_name)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; font-size:12px; line-height:1.5; color:#64716b;">전화</td>
                    <td style="padding:6px 0; font-size:13px; line-height:1.5; color:#1b2421;">{html_text(care_tel)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0; font-size:12px; line-height:1.5; color:#64716b;">보호 종료</td>
                    <td style="padding:6px 0; font-size:13px; line-height:1.5; color:#1b2421;">{html_text(notice_end)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    """.strip()


def build_html(digest: dict[str, Any]) -> str:
    candidates = digest["candidates"]
    if candidates:
        candidate_cards = "\n".join(
            build_candidate_card(candidate, index)
            for index, candidate in enumerate(candidates, start=1)
        )
    else:
        candidate_cards = """
      <tr>
        <td style="padding:20px; border:1px solid #e2d8ca; background:#fffdfa; color:#46544f; font-size:14px; line-height:1.6;">
          오늘 preview에 포함할 알림 후보가 없습니다.
        </td>
      </tr>
        """.strip()

    total_count = len(candidates)
    urgent_count = count_label(candidates, "긴급 확인")
    soon_count = count_label(candidates, "곧 종료")
    summary_cells = "\n".join(
        [
            build_summary_cell("전체 후보", total_count, "#31584e"),
            build_summary_cell("긴급 확인", urgent_count, "#72552d"),
            build_summary_cell("곧 종료", soon_count, "#31584e"),
        ]
    )

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>{html.escape(digest["subject"])}</title>
</head>
<body style="margin:0; padding:0; background:#f8f4ec; color:#1b2421;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f8f4ec;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; border-collapse:collapse; background:#fffdfa; border:1px solid #e2d8ca;">
          <tr>
            <td style="padding:28px 28px 22px 28px; border-bottom:1px solid #e2d8ca; background:#fffdfa;">
              <div style="font-family:Arial, 'Malgun Gothic', sans-serif; font-size:13px; line-height:1.5; color:#64716b;">Shelter Signal V2 preview</div>
              <h1 style="margin:6px 0 0 0; font-family:Arial, 'Malgun Gothic', sans-serif; font-size:26px; line-height:1.25; color:#1b2421;">Shelter Signal</h1>
              <p style="margin:8px 0 0 0; font-family:Arial, 'Malgun Gothic', sans-serif; font-size:15px; line-height:1.6; color:#31584e;">{html.escape(SUBTITLE_COPY)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 8px 28px; font-family:Arial, 'Malgun Gothic', sans-serif;">
              <p style="margin:0; font-size:16px; line-height:1.7; color:#1b2421;">{html.escape(digest["intro"])}</p>
              <p style="margin:8px 0 0 0; font-size:14px; line-height:1.7; color:#46544f;">{html.escape(digest["safety_note"])}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 8px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  {summary_cells}
                </tr>
              </table>
              <div style="padding:0 4px; font-family:Arial, 'Malgun Gothic', sans-serif; font-size:12px; line-height:1.5; color:#64716b;">생성 시각: {html.escape(generated_at_text(digest))}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 6px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                {candidate_cards}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 26px 28px; border-top:1px solid #e2d8ca; background:#fbf8f1; font-family:Arial, 'Malgun Gothic', sans-serif;">
              <p style="margin:0; font-size:13px; line-height:1.7; color:#64716b;">{html.escape(HTML_FOOTER_NOTE)}</p>
              <p style="margin:8px 0 0 0; font-size:13px; line-height:1.7; color:#46544f;">{html.escape(digest["safety_note"])}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
