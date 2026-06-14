# Shelter Signal Production Evidence

이 폴더는 현재 Shelter Signal Production의 live-first 운영 상태를 확인한 public-safe evidence를 보관합니다.

## Current Evidence

Evidence date: **2026-06-15 KST**

- [Production verification summary](production-verification-2026-06-15.md)
- [Safe Production API metadata](production-api-metadata-2026-06-15.json)
- [GitHub Actions Verify result](github-actions-verify-2026-06-15.json)
- [Production UI screenshot](../screenshots/10-live-first-production-ui-2026-06-15.png)

## Evidence Boundary

현재 evidence는 다음을 확인합니다.

- Production UI가 `Live API` 상태를 표시함
- fallback warning이 live 응답에서 표시되지 않음
- `/api/notices`가 `source: "api"`와 safe metadata를 반환함
- current/urgent view에 expired 또는 missing-deadline 행이 누수되지 않음
- urgent 결과가 `days_left` 오름차순이며 0~3 범위임
- GitHub Actions `Verify`가 secrets 없이 통과함

현재 evidence는 다음을 증명하지 않습니다.

- 전체 upstream dataset의 완전성 또는 정확성
- 공공기관별 갱신 주기와 실제 현장 상태의 일치
- 모든 지역·날짜·fallback 조합의 전수 검증
- 운영 SLA, 사용자 성과, 구조·입양 결과

## Public-safe Policy

- API evidence에는 notice rows를 포함하지 않고 safe metadata와 집계 검사 결과만 기록합니다.
- UI screenshot에는 service key, 환경 변수, raw API URL, 동물 연락처를 포함하지 않습니다.
- GitHub Actions evidence에는 공개 run 상태와 step 결과만 기록합니다.
- `.env`, `DATABASE_URL`, service key, connection string, full upstream URL은 저장하지 않습니다.

## Historical Evidence

과거 PostgreSQL-primary 검증 캡처는 [screenshots README](../screenshots/README.md)의 `Historical Operational DB Evidence`에 별도로 분류되어 있습니다. 해당 자료는 현재 Production architecture evidence가 아닙니다.
