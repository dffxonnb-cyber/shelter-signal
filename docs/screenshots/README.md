# Shelter Signal Screenshots

이 폴더는 Shelter Signal의 제품 흐름과 구현 이력을 설명하는 tracked screenshot set입니다.

## Product-flow Screenshots

다음 캡처는 제품 흐름 설명용입니다. UI가 변경되면 Production과 일치하는지 다시 확인해야 합니다.

- `01-landing-hero.png`: 제품 메시지와 CTA
- `02-app-preview-home.png`: 앱 preview 홈
- `03-golden-time.png`: 종료 임박 공고 흐름
- `04-notices-filter.png`: 공고 필터
- `05-region-explorer.png`: 지역 탐색
- `06-detail-sheet.png`: 공고 상세와 연락 맥락
- `07-data-pipeline.png`: 당시 데이터 흐름 설명

## Historical Operational DB Evidence

다음 캡처는 2026-06-05 이전 PostgreSQL-primary 검증 단계의 historical evidence입니다.

- `08-operational-db-badge.png`
- `09-api-notices-operational-response.png`

이 두 파일은 현재 Production source 또는 현재 UI 상태를 나타내지 않습니다. 현재 Production은 live-first public API 구조이며, 성공 응답은 `source: "api"`와 `Live API` 상태를 사용합니다.

## Capture Safety

- service key, `DATABASE_URL`, connection string, secret 환경 값, full upstream URL을 포함하지 않습니다.
- API evidence에는 safe response metadata만 사용합니다.
- fallback 화면은 live 화면으로 소개하지 않습니다.
- 캡처 시점과 현재 구현이 다르면 historical 또는 archived로 명확히 표시합니다.

## Recommended Current Evidence

새 Production evidence를 캡처할 때는 다음을 우선 확인합니다.

- UI data status panel의 `Live API`
- fallback warning이 숨겨진 상태
- 지역 필터와 `공고 더 보기`
- `/api/notices`의 `source`, `cacheStatus`, `dateRange`, count, pagination metadata
- `fallbackReason`이 live/cache 응답에서 비어 있는 상태
