# Email Digest Preview

## Purpose

Shelter Signal V2의 첫 구현 단계는 실제 이메일을 보내기 전에, 매일 확인할 구조동물 공고 후보를 SQL로 고르고 digest preview 파일로 확인하는 것입니다.

이 단계는 알림 발송 시스템이 아니라 preview-only 기반입니다. 생성되는 파일은 로컬 검토용이며 실제 수신자, API key, 이메일 credential을 포함하지 않습니다.

## How Alert Candidates Are Selected

`sql/models/006_alert_candidates.sql`는 `mart.animals_clean`을 읽어 `mart.alert_candidates` view를 만듭니다.

후보 선정 기준은 다음과 같습니다.

- 가능한 경우 active notice만 포함
- 보호 종료일까지 남은 일수가 3일 이하인 공고 포함
- Rescue Window 라벨이 `긴급 확인` 또는 `곧 종료`인 공고 포함
- 직접 후보가 적을 때 Rescue Window Score 상위 공고를 fallback으로 포함

각 후보에는 Korean alert reason과 정렬용 priority가 붙습니다.

- `보호 종료 임박`
- `긴급 확인 라벨`
- `곧 종료 라벨`
- `우선 확인 점수 상위`

`alert_priority`는 낮을수록 먼저 확인해야 하는 후보입니다.

## How To Generate Preview Files

먼저 로컬 PostgreSQL과 SQL model을 준비합니다.

```powershell
python scripts/validate_pipeline.py
```

그 다음 preview export를 실행합니다.

```powershell
python scripts/export_email_digest.py
```

생성 파일은 다음 위치에 저장됩니다.

```text
data/exports/email_digest_preview.json
data/exports/email_digest_preview.html
```

`data/exports/*.json`과 `data/exports/*.html`은 live data가 포함될 수 있으므로 Git에 커밋하지 않습니다. 폴더 유지를 위해 `data/exports/.gitkeep`만 커밋합니다.

## HTML Preview Principle

HTML preview는 “minimal daily report, not marketing newsletter.” 원칙을 따릅니다. 앱 카드 UI나 홍보성 뉴스레터처럼 보이지 않도록 대부분을 텍스트 기반으로 구성하고, 얇은 구분선과 아주 옅은 배경만 사용합니다.

이메일 클라이언트 호환성을 우선해 단순한 table/block layout과 inline style만 사용합니다. JavaScript, 외부 폰트, 외부 CSS 파일은 사용하지 않습니다.

구성은 다음 순서입니다.

- Header: `Shelter Signal`, `보호 종료가 가까운 공고를 먼저 확인합니다.`
- Summary line: 오늘 확인할 공고 수와 생성일
- Short notice: 공식 확인 안내
- Candidate list: 번호가 붙은 report item과 얇은 구분선
- Footer: preview-only 안내와 공식 확인 안내 반복

## Why Emails Are Preview-Only In This Phase

V2의 현재 단계는 후보 선정과 문구 안전성을 검증하는 단계입니다. 실제 이메일 발송은 아직 구현하지 않습니다.

preview-only로 시작하는 이유는 다음과 같습니다.

- 후보 선정 기준을 사람이 먼저 확인해야 합니다.
- 공고 상태는 바뀔 수 있으므로 과도한 확정 표현을 피해야 합니다.
- 구독자 관리, unsubscribe, bounce 처리, 발송 평판 관리가 아직 없습니다.
- 실제 이메일 credential과 수신자 정보를 저장소에 두면 안 됩니다.

## Safety And Ethics Notes

이메일 문구는 차분한 확인 안내로 유지합니다.

사용하는 문구:

- 오늘 확인할 보호 종료 임박 공고를 정리했어요.
- 공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요.

사용하지 않는 문구 방향:

- 공포나 죄책감을 유도하는 문장
- 확정되지 않은 생존 가능성을 단정하는 문장
- 사용자의 즉시 행동을 압박하는 문장

Rescue Window Score는 공식 위험 점수나 입양 결과 예측 모델이 아니라, 공고 확인 순서를 돕는 내부 탐색 신호입니다.

## Next Step Toward n8n

다음 단계는 n8n workflow 문서와 preview export를 연결하는 것입니다.

예상 흐름은 다음과 같습니다.

```text
Public API
→ n8n scheduled ingestion
→ PostgreSQL upsert
→ SQL models
→ alert_candidates
→ email digest preview
→ later email sending
```

실제 email sending은 preview 검증, 안전 문구 검토, credential 관리 방식, 수신자 동의 흐름이 준비된 뒤 별도 단계에서 다룹니다.
