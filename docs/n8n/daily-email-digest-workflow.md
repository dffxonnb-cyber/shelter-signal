# Daily Email Digest Workflow

## V2 Workflow Purpose

Shelter Signal V2의 n8n workflow는 구조동물 공고 데이터를 매일 수집하고, SQL로 계산한 `mart.alert_candidates` 결과를 이메일 digest preview로 확인하는 자동화 흐름을 문서화하기 위한 계획입니다.

현재 단계는 preview + workflow planning입니다. 실제 이메일 발송, SMS, 사용자 계정, 구독 관리, live backend API는 구현하지 않습니다.

## Daily Schedule Concept

초기 실행 주기는 하루 1회입니다. 예시는 오전 시간대 실행을 기준으로 하지만, 운영 전에는 API 호출 제한, 담당자 확인 시간, 로컬/서버 시간대를 함께 검토해야 합니다.

권장 초안:

- Schedule: 매일 오전 8시
- Timezone: 운영 환경 기준으로 명시
- First target: local preview generation
- Email sending: disabled placeholder only

## Required Environment Variables

실제 값은 n8n credential, 로컬 `.env`, 또는 배포 환경 변수에만 둡니다. 이 문서와 workflow outline에는 값을 포함하지 않습니다.

```text
ANIMAL_API_KEY
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_HOST
POSTGRES_PORT
POSTGRES_SERVICE
EMAIL_FROM
EMAIL_PREVIEW_RECIPIENT_DISABLED
```

`EMAIL_PREVIEW_RECIPIENT_DISABLED`는 실제 수신자 값이 아니라, preview 단계에서 발송을 막기 위한 자리표시자입니다.

## Local Development Assumptions

- PostgreSQL은 Docker Compose로 실행합니다.
- 데이터 적재는 기존 ingestion script와 SQL model 흐름을 따릅니다.
- `scripts/validate_pipeline.py`가 SQL model과 tests를 적용합니다.
- `scripts/export_email_digest.py`가 preview-only JSON/HTML을 생성합니다.
- 생성 파일은 `data/exports/email_digest_preview.json`과 `data/exports/email_digest_preview.html`입니다.
- `data/exports/*.json`과 `data/exports/*.html`은 Git에 커밋하지 않습니다.

## Dry-Run Workflow Stage

현재 n8n integration의 첫 목표는 실제 발송이 아니라, n8n이 로컬 dry-run command를 실행해 preview 산출물을 만들 수 있는지 확인하는 것입니다.

로컬 dry-run workflow 초안은 [daily-digest-dry-run.workflow.json](daily-digest-dry-run.workflow.json)에 두고, 실행 방법은 [local-dry-run-setup.md](local-dry-run-setup.md)에 정리합니다.

이 단계의 workflow는 다음만 검증합니다.

- n8n Manual Trigger가 workflow를 시작할 수 있음
- Execute Command node가 `python scripts/run_daily_digest_dry_run.py`를 실행할 수 있음
- `mart.alert_candidates`를 읽어 digest preview JSON/HTML을 생성할 수 있음
- 생성된 `data/exports/email_digest_preview.json`과 `data/exports/email_digest_preview.html` 파일이 존재함

이 단계는 실제 수신자, Gmail/SMTP credential, SMS, 사용자 계정, auth, API key를 요구하지 않습니다. Email Send node는 placeholder로만 두며 disabled 상태를 유지합니다.

실제 이메일 발송은 preview 품질 확인, 안전 문구 검토, credential 관리, 수신자 동의, unsubscribe, bounce 처리, 발송 제한 기준이 준비된 뒤 별도 단계에서 다룹니다.

## Production Caution Notes

이 workflow는 production-ready 알림 시스템이 아닙니다.

- 실제 이메일 발송은 아직 비활성화 상태로 둡니다.
- 구독자 동의, unsubscribe, bounce 처리, 발송 제한, 발송 평판 관리가 없습니다.
- API key, DB password, SMTP credential, OAuth token은 문서나 JSON outline에 넣지 않습니다.
- 실패한 workflow가 V1 PWA의 static JSON 배포를 깨뜨리면 안 됩니다.
- 운영 전에는 staging database와 별도 credential scope를 먼저 검토합니다.

## Step-by-Step n8n Workflow Outline

1. Cron Trigger

   매일 정해진 시간에 workflow를 시작합니다. 처음에는 수동 실행과 cron 실행을 모두 preview-only로 확인합니다.

2. Ingestion Step

   Execute Command 또는 HTTP Request node로 구조동물 공고 수집을 시작합니다. 로컬 개발에서는 기존 ingestion script를 호출하는 방식이 가장 단순합니다.

3. Pipeline Validation Step

   Execute Command node에서 `python scripts/validate_pipeline.py`를 실행해 migration, mock/API 적재, SQL models, SQL tests를 검증합니다.

4. Email Digest Preview Export Step

   Execute Command node에서 `python scripts/export_email_digest.py`를 실행합니다. 이 단계는 JSON/HTML preview만 만들고 이메일은 보내지 않습니다.

5. Read Generated HTML Step

   Read Binary File 또는 Read File equivalent node로 `data/exports/email_digest_preview.html`을 읽습니다.

6. Email Send Placeholder

   실제 email node는 disabled 상태 또는 placeholder로 둡니다. credential과 recipient는 설정하지 않습니다.

7. Error Handling Placeholder

   실패 시 n8n execution log에서 오류를 확인합니다. 추후 Slack, email, dashboard 알림을 붙일 수 있지만 현재 단계에서는 외부 알림을 보내지 않습니다.

## Safety/Ethics Notes

이메일 digest는 차분한 확인 안내로 유지합니다.

사용하는 핵심 문구:

- 오늘 확인할 보호 종료 임박 공고를 정리했어요.
- 공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요.

피해야 할 방향:

- 공포나 죄책감을 유도하는 문장
- 입양 가능성이나 생존 가능성을 단정하는 문장
- 사용자의 즉시 행동을 압박하는 문장

Rescue Window Score는 공식 위험 점수나 결과 예측 모델이 아니라, 공고 확인 순서를 돕는 내부 탐색 신호입니다.

## Failure Handling

- API request failure: workflow를 실패로 기록하고 DB write를 진행하지 않습니다.
- PostgreSQL failure: validation/export 단계를 중단합니다.
- SQL test failure: email preview export를 중단합니다.
- Preview export failure: email placeholder 단계로 넘어가지 않습니다.
- Missing HTML file: 발송 placeholder는 실행하지 않습니다.
- Credential missing: 정상입니다. 현재 단계에서는 email credential을 요구하지 않습니다.

## Future Implementation Steps

1. n8n local workflow를 수동 실행으로 검증
2. API ingestion과 PostgreSQL upsert를 실제 workflow node로 분리
3. `mart.alert_candidates` 결과와 preview HTML 품질 확인
4. email send node를 계속 disabled 상태로 두고 preview review 절차 확정
5. staging-only recipient와 unsubscribe 정책 설계
6. credential 관리와 발송 제한 기준 문서화
7. 실제 발송은 별도 승인된 단계에서 구현
