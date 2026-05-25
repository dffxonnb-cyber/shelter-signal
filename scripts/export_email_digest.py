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
        return "종료 확인"
    if days == 0:
        return "D-0"
    return f"D-{days}"


def generated_at_text(digest: dict[str, Any]) -> str:
    generated_at = text_or_dash(digest.get("generated_at"))
    return generated_at.replace("T", " ").replace("+00:00", " UTC")


def report_generated_at(digest: dict[str, Any]) -> str:
    raw_value = digest.get("generated_at")
    if not isinstance(raw_value, str):
        return generated_at_text(digest)
    try:
        generated_at = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        return generated_at_text(digest)
    return generated_at.strftime("%Y-%m-%d %H:%M")


def is_urgent_candidate(candidate: dict[str, Any]) -> bool:
    label = text_or_dash(candidate.get("rescue_window_label"))
    days = as_int(candidate.get("days_until_notice_end"))
    return label == "긴급 확인" or (days is not None and days <= 1)


def is_soon_ending_candidate(candidate: dict[str, Any]) -> bool:
    label = text_or_dash(candidate.get("rescue_window_label"))
    days = as_int(candidate.get("days_until_notice_end"))
    return label == "곧 종료" or (days is not None and 2 <= days <= 3)


def badge_style(candidate: dict[str, Any]) -> str:
    if is_urgent_candidate(candidate):
        return "background:#eadcc6; border:1px solid #c8ad7f; color:#5a4630;"
    return "background:#e4e9df; border:1px solid #c5cebf; color:#334d42;"


def pill_style(candidate: dict[str, Any]) -> str:
    if is_urgent_candidate(candidate):
        return "background:#f5ead7; border:1px solid #dfc79e; color:#5a4630;"
    return "background:#edf1eb; border:1px solid #d7ddd3; color:#3f5a4c;"


def build_candidate_card(candidate: dict[str, Any]) -> str:
    kind = candidate.get("kind_full_nm") or candidate.get("kind_nm") or "품종 미상"
    place = candidate.get("happen_place") or candidate.get("org_nm") or "발견 장소 확인 필요"
    care_name = candidate.get("care_nm") or "보호소 확인 필요"
    care_tel = candidate.get("care_tel") or "전화번호 확인 필요"
    notice_end = candidate.get("notice_edt") or "보호 종료일 확인 필요"
    score = candidate.get("rescue_window_score")
    label = candidate.get("rescue_window_label") or "우선 확인"
    reason = candidate.get("alert_reason") or "우선 확인"

    return f"""
      <tr>
        <td style="padding:0 0 14px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:0; background:#fffdf8; border:1px solid #ded8cc; border-radius:16px; box-shadow:0 2px 8px rgba(32,35,31,0.06);">
            <tr>
              <td style="padding:18px 18px 4px 18px; font-family:Arial, 'Malgun Gothic', sans-serif; vertical-align:top;">
                <span style="display:inline-block; padding:4px 9px; border-radius:999px; font-size:11px; line-height:1.35; font-weight:700; {pill_style(candidate)}">{html_text(label)}</span>
              </td>
              <td width="70" align="right" style="padding:14px 14px 0 0; font-family:Arial, 'Malgun Gothic', sans-serif; vertical-align:top;">
                <div style="width:56px; height:56px; border-radius:50%; text-align:center; font-size:14px; line-height:56px; font-weight:700; {badge_style(candidate)}">{html.escape(d_day_text(candidate))}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding:0 18px 18px 18px; font-family:Arial, 'Malgun Gothic', sans-serif;">
                <div style="font-size:18px; line-height:1.45; color:#20231f; font-weight:700;">{html_text(kind)}</div>
                <div style="margin-top:5px; font-size:13px; line-height:1.65; color:#515852;">{html_text(place)} · {html_text(care_name)}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px; border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 6px 0; font-family:Arial, 'Malgun Gothic', sans-serif; font-size:13px; line-height:1.6; color:#6f746e; width:86px;">보호 종료일</td>
                    <td style="padding:0 0 6px 0; font-family:Arial, 'Malgun Gothic', sans-serif; font-size:13px; line-height:1.6; color:#20231f;">{html_text(notice_end)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 6px 0; font-family:Arial, 'Malgun Gothic', sans-serif; font-size:13px; line-height:1.6; color:#6f746e;">연락처</td>
                    <td style="padding:0 0 6px 0; font-family:Arial, 'Malgun Gothic', sans-serif; font-size:13px; line-height:1.6; color:#20231f;">{html_text(care_tel)}</td>
                  </tr>
                </table>
                <div style="margin-top:6px; padding-top:10px; border-top:1px solid #ebe4d8; font-size:12px; line-height:1.6; color:#515852;">
                  Rescue Window {html_text(score)} · 사유: {html_text(reason)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    """.strip()


def build_html(digest: dict[str, Any]) -> str:
    candidates = digest["candidates"]
    if candidates:
        candidate_cards = "\n".join(build_candidate_card(candidate) for candidate in candidates)
    else:
        candidate_cards = """
      <tr>
        <td style="padding:18px; background:#fffdf8; border:1px solid #ded8cc; border-radius:16px; font-family:Arial, 'Malgun Gothic', sans-serif; color:#515852; font-size:14px; line-height:1.7;">
          오늘 preview에 포함할 알림 후보가 없습니다.
        </td>
      </tr>
        """.strip()

    total_count = len(candidates)
    urgent_count = sum(1 for candidate in candidates if is_urgent_candidate(candidate))
    soon_count = sum(1 for candidate in candidates if is_soon_ending_candidate(candidate))

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>{html.escape(digest["subject"])}</title>
</head>
<body style="margin:0; padding:0; background:#f6f1e8; color:#20231f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; background:#f6f1e8;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; border-collapse:collapse;">
          <tr>
            <td style="padding:0 4px 18px 4px; font-family:Arial, 'Malgun Gothic', sans-serif;">
              <div style="font-size:22px; line-height:1.35; font-weight:700; color:#20231f;">Shelter Signal</div>
              <div style="margin-top:4px; font-size:14px; line-height:1.6; color:#3f5a4c;">{html.escape(SUBTITLE_COPY)}</div>
              <div style="margin-top:8px; font-size:12px; line-height:1.5; color:#777a74;">생성일: {html.escape(report_generated_at(digest))}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px; background:#fffdf8; border:1px solid #ded8cc; border-radius:16px; font-family:Arial, 'Malgun Gothic', sans-serif;">
              <p style="margin:0; font-size:15px; line-height:1.7; color:#20231f;">{html.escape(digest["intro"])}</p>
              <p style="margin:8px 0 0 0; font-size:13px; line-height:1.7; color:#515852;">{html.escape(digest["safety_note"])}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 0 18px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:0; background:#eef1ea; border:1px solid #d9ded4; border-radius:14px;">
                <tr>
                  <td align="center" style="padding:12px 6px; font-family:Arial, 'Malgun Gothic', sans-serif; border-right:1px solid #d9ded4;">
                    <div style="font-size:11px; line-height:1.4; color:#6f746e;">전체 후보</div>
                    <div style="margin-top:2px; font-size:18px; line-height:1.3; font-weight:700; color:#20231f;">{html_text(total_count)}건</div>
                  </td>
                  <td align="center" style="padding:12px 6px; font-family:Arial, 'Malgun Gothic', sans-serif; border-right:1px solid #d9ded4;">
                    <div style="font-size:11px; line-height:1.4; color:#6f746e;">긴급 확인</div>
                    <div style="margin-top:2px; font-size:18px; line-height:1.3; font-weight:700; color:#6f5532;">{html_text(urgent_count)}건</div>
                  </td>
                  <td align="center" style="padding:12px 6px; font-family:Arial, 'Malgun Gothic', sans-serif;">
                    <div style="font-size:11px; line-height:1.4; color:#6f746e;">곧 종료</div>
                    <div style="margin-top:2px; font-size:18px; line-height:1.3; font-weight:700; color:#3f5a4c;">{html_text(soon_count)}건</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                {candidate_cards}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 4px 0 4px; font-family:Arial, 'Malgun Gothic', sans-serif;">
              <p style="margin:0; font-size:12px; line-height:1.7; color:#6f746e;">{html.escape(HTML_FOOTER_NOTE)}</p>
              <p style="margin:6px 0 0 0; font-size:12px; line-height:1.7; color:#6f746e;">{html.escape(digest["safety_note"])}</p>
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
