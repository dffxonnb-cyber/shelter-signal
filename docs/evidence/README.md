# Shelter Signal Production Evidence

이 폴더는 현재 Shelter Signal Production의 live-first 운영 상태를 확인한 public-safe evidence를 보관합니다.

## Current Evidence

Evidence date: 2026-06-15 KST

* [Production verification summary](production-verification-2026-06-15.md)
* [Safe Production API metadata](production-api-metadata-2026-06-15.json)
* [GitHub Actions Verify result](github-actions-verify-2026-06-15.json)
* [Production UI screenshot](../screenshots/10-live-first-production-ui-2026-06-15.png)

## Monthly Snapshot Workflow Dry-run Evidence

Evidence date: 2026-06-27 KST

* [Monthly snapshot workflow dry-run](monthly-snapshot-dry-run-2026-06-27.md)

This evidence documents the manual GitHub Actions dry-run path for monthly public-data snapshot generation.

Verified path:

* Monthly Notice Snapshot workflow
* workflow_dispatch trigger
* dry_run=true
* snapshot script syntax check
* planned output path resolution
* no public API request
* no snapshot JSON write
* no DATA_GO_KR_SERVICE_KEY requirement

This is not actual public API collection evidence.

It does not claim complete upstream-data freshness, public API completeness, real-time notice delivery, shelter operation status, adoption outcomes, or successful live public API collection.

## V2 Dry-run Evidence

Evidence date: 2026-06-19 KST

* [V2 dry-run evidence](v2-dry-run-2026-06-19.md)

This evidence documents the local preview path for alert candidate and digest generation.

Verified path:

* mart.alert_candidates
* daily digest JSON/HTML preview
* local dry-run validation

This is not Production notification evidence.

It does not claim real email, SMS, push delivery, real recipients, subscription management, Production schedules, monitoring, or delivery SLA.

## Evidence Boundary

현재 evidence는 다음을 확인합니다.

* Production UI가 Live API 상태를 표시함
* fallback warning이 live 응답에서 표시되지 않음
* /api/notices가 source: api와 safe metadata를 반환함
* current/urgent view에 expired 또는 missing-deadline 행이 누수되지 않음
* urgent 결과가 days_left 오름차순이며 0~3 범위임
* GitHub Actions Verify가 secrets 없이 통과함
* Monthly Notice Snapshot workflow가 dry-run 모드에서 수동 실행 가능함

현재 evidence는 다음을 증명하지 않습니다.

* 전체 upstream dataset의 완전성 또는 정확성
* 공공기관별 갱신 주기와 실제 현장 상태의 일치
* 모든 지역·날짜·fallback 조합의 전수 검증
* 실제 월간 snapshot 생성 완료
* 운영 SLA, 사용자 성과, 구조·입양 결과

## Public-safe Policy

* API evidence에는 notice rows를 포함하지 않고 safe metadata와 집계 검사 결과만 기록합니다.
* UI screenshot에는 service key, 환경 변수, raw API URL, 동물 연락처를 포함하지 않습니다.
* GitHub Actions evidence에는 공개 run 상태와 step 결과만 기록합니다.
* .env, DATABASE_URL, service key, connection string, full upstream URL은 저장하지 않습니다.

## Historical Evidence

과거 PostgreSQL-primary 검증 캡처는 [screenshots README](../screenshots/README.md)의 Historical Operational DB Evidence에 별도로 분류되어 있습니다. 해당 자료는 현재 Production architecture evidence가 아닙니다.

## Monthly Snapshot Live Run Evidence

Evidence date: 2026-06-29 KST

* [Monthly snapshot live run](monthly-snapshot-live-2026-06-29.md)

This evidence documents a successful GitHub Actions workflow_dispatch run with dry_run=false.

Verified path:

* Monthly Notice Snapshot workflow
* workflow_dispatch trigger
* dry_run=false
* snapshot script syntax check
* live monthly snapshot generation step
* generated snapshot commit step
* successful workflow completion

This evidence does not claim real-time notice delivery, complete upstream-data availability, shelter operation status, adoption outcomes, or production SLA.
