# Shelter Signal

[![Verify](https://github.com/dffxonnb-cyber/shelter-signal/actions/workflows/verify.yml/badge.svg)](https://github.com/dffxonnb-cyber/shelter-signal/actions/workflows/verify.yml)
[![Live](https://img.shields.io/badge/live-Vercel-000000?logo=vercel&logoColor=white)](https://shelter-signal-ebon.vercel.app/)
[![Source](https://img.shields.io/badge/source-live%20API-2563eb)](https://shelter-signal-ebon.vercel.app/api/notices?view=current&limit=20)
[![PWA](https://img.shields.io/badge/app-mobile%20PWA-0f766e)](https://shelter-signal-ebon.vercel.app/)
[![Evidence](https://img.shields.io/badge/evidence-public--safe-6b7280)](docs/evidence/v2-production-verification-2026-07-14.md)

**Shelter Signal은 불안정한 공공데이터 구조동물 공고를 현재 탐색과 시간 변화 추적으로 분리한 모바일 우선 데이터 제품입니다.**

- Production: https://shelter-signal-ebon.vercel.app/
- V1 current notices: https://shelter-signal-ebon.vercel.app/#live
- V2 today changes: https://shelter-signal-ebon.vercel.app/#changes
- V2 deadline briefing: https://shelter-signal-ebon.vercel.app/#briefing
- Portfolio case study: [docs/portfolio-case-study.md](docs/portfolio-case-study.md)
- V2 roadmap and boundary: [docs/v2-roadmap.md](docs/v2-roadmap.md)
- Verification guide: [VERIFY.md](VERIFY.md)
- Current V2 evidence: [docs/evidence/v2-production-verification-2026-07-14.md](docs/evidence/v2-production-verification-2026-07-14.md)

Shelter Signal은 실제 보호소 운영 시스템이나 알림 발송 서비스가 아닙니다. 사용자 계정, 실제 구독, 외부 이메일·문자·푸시 발송, 운영 SLA는 포함하지 않습니다.

## V1 And V2

| Version | Question | Main product surface |
| --- | --- | --- |
| **V1 · Current notices** | 지금 어떤 공고가 있는가? | 실시간 API 기반 현재·긴급·보호·아카이브 탐색 |
| **V2 · History-aware** | 어제와 무엇이 달라졌고 오늘 무엇을 먼저 봐야 하는가? | 일별 수집, 변화 이벤트, 공고 타임라인, 마감 브리핑 |

V1의 live-first 경로는 그대로 유지하고, V2는 별도의 보존·비교·판단 계층을 추가합니다.

## 3-Minute Reviewer Path

| Step | Open | What to check |
| --- | --- | --- |
| 1 | [V1 current notices](https://shelter-signal-ebon.vercel.app/#live) | Live API 상태, 지역 필터, D-Day, pagination, fallback 경계 |
| 2 | [V2 today changes](https://shelter-signal-ebon.vercel.app/#changes) | 새 공고·상태 변화·미관측 분리, 수집 상태, 이벤트 근거 |
| 3 | [V2 deadline briefing](https://shelter-signal-ebon.vercel.app/#briefing) | D-Day~D-3 우선순위, 지역·마감 필터, 포함 이유 |
| 4 | 변화 카드 선택 | 공고별 누적 변화 타임라인과 값 변경 이력 |
| 5 | [V2 production evidence](docs/evidence/v2-production-verification-2026-07-14.md) | 자동 수집·이벤트·타임라인의 public-safe 검증 범위 |

## Reliability Snapshot

| Layer | What was designed |
| --- | --- |
| **Live source** | Vercel `/api/notices`가 data.go.kr 구조동물 공고 API를 server-side에서 우선 조회 |
| **Freshness** | KST 기준 날짜 정규화와 `noticeEdt` 기반 current/urgent 분리 |
| **Views** | `current`, `urgent`, `protected`, `archive` 상태 분리 |
| **Pagination** | 기본 20건, 최대 100건, server-side page/limit와 `공고 더 보기` |
| **Cache** | 정규화된 live dataset을 짧게 보관하고 in-flight 요청을 가능한 경우 공유 |
| **Fallback** | live 실패 시에만 PostgreSQL → static JSON → mock 순서로 대체 |
| **Preservation** | 매일 06:20 KST GitHub Actions가 public-safe snapshot을 생성·커밋 |
| **Change detection** | 안정 공고 키를 기준으로 신규·변경·미관측·복귀 이벤트 생성 |
| **Timeline** | 이벤트를 공고별로 누적하고 `eventId` 기준 중복 제거 |
| **Decision brief** | D-Day~D-3와 당일 변화 근거를 결합해 확인 순서를 설명 |
| **Observability** | source, cache, pagination, collection count, truncation, warnings 표시 |
| **Secret boundary** | service key와 `DATABASE_URL`은 server-side에서만 사용 |

## Current Architecture

```text
V1 live path
React PWA
  → Vercel /api/notices
    → short normalized-data cache
      → data.go.kr rescued-animal notice API
    → KST freshness normalization
    → current / urgent / protected / archive
    → region / page / limit response

V2 history path
GitHub Actions daily schedule · 06:20 KST
  → public API monthly-window snapshot
  → latest + monthly public-safe JSON
  → compare with previous successful snapshot
  → daily change events + missing state
  → per-notice cumulative timeline
  → today-change dashboard + deadline briefing
```

브라우저는 공공데이터 API나 PostgreSQL에 직접 연결하지 않습니다. 비밀키, DB URL, 토큰, secret이 포함된 upstream URL은 frontend bundle과 공개 JSON에 저장하지 않습니다.

## V1 Notice API

Default upstream request:

```text
bgnde = today in Asia/Seoul minus 30 days
endde = today in Asia/Seoul
state = notice
pageNo = 1
numOfRows = 1000
_type = json
```

Supported response-layer query parameters:

```text
view = current | urgent | protected | archive
region = 서울 | 서울특별시 | 경기 | 경기도 | ...
page = 1..N
limit = 20 by default, capped at 100
```

Example:

```text
/api/notices?view=urgent&region=서울&limit=20
/api/notices?view=current&region=경기&page=2&limit=20
```

`noticeEdt`를 공개 공고 종료일로 사용하고 KST 기준 `days_left`와 `deadline_status`를 계산합니다.

```text
D-Day | D-1 | D-2 | D-3 | active | expired
```

- `current`: 종료되지 않았고 종료일이 유효한 공고
- `urgent`: `days_left`가 0~3인 공고
- `protected`: current 중 process state가 보호 상태인 공고
- `archive`: 만료 또는 종료 상태를 명시적으로 요청한 경우

정상적인 live 0건 응답은 fallback으로 바꾸지 않고 `source: api`인 empty state로 처리합니다.

## V2 Daily Preservation

[Notice Snapshot Archive](.github/workflows/monthly-notice-snapshot.yml)는 두 방식으로 실행됩니다.

- Scheduled: 매일 `21:20 UTC`, 즉 다음 날 `06:20 KST`
- Manual recovery: GitHub Actions `workflow_dispatch`
- `dry_run=true`: 외부 API와 파일 쓰기 없이 경로 검증
- `dry_run=false`: 실제 public-safe snapshot·이벤트·타임라인 생성

Generated and maintained files:

```text
app/public/data/latest-notices.json
app/public/data/latest-notices.meta.json
app/public/data/monthly-notices/YYYY-MM.json
app/public/data/monthly-notices/YYYY-MM.meta.json
app/public/data/daily-events/YYYY-MM-DD.json
app/public/data/latest-events.json
app/public/data/missing-notices.json
app/public/data/notice-timelines.json
```

GitHub에 매일 전체 월 데이터를 새 파일로 복제하지는 않습니다. 최신·월간 snapshot은 갱신하고, 날짜별 변화 이벤트와 공고별 누적 타임라인을 별도로 보존합니다.

## V2 Change Event Model

Stable key priority:

```text
desertion_no → notice_no fallback
```

Event types:

| Event | Meaning |
| --- | --- |
| `NEW` | 이전 성공 수집에는 없고 현재 수집에서 관측 |
| `DEADLINE_CHANGED` | 공고 종료일 변경 |
| `STATUS_CHANGED` | 처리 상태 변경 |
| `BECAME_URGENT` | D-3 이내 구간 진입 |
| `NOT_OBSERVED` | 동일 관측 창의 한 번 미관측 |
| `DISAPPEARED` | 서로 다른 날짜에 두 번 이상 미관측 |
| `RETURNED` | 미관측 상태였던 공고가 다시 관측 |

한 번의 누락을 종료로 단정하지 않으며, 월별 조회 창이 바뀔 때 대량 가짜 미관측 이벤트가 생기지 않도록 경계를 둡니다. 상세 스키마는 [docs/change-event-schema.md](docs/change-event-schema.md)를 참고합니다.

## V2 Product Surfaces

### Today-change dashboard

- 새 공고, 마감 변화, 상태 변화, 미관측 요약
- 이전·현재 관측 건수와 증감
- 수집 페이지, 원천 건수, truncation, warnings
- 변화 유형별 필터

### Per-notice timeline

- 최초·최근 변화 관측 시각
- 누적 이벤트와 유형별 횟수
- 종료일·상태·남은 날짜의 이전 값 → 현재 값
- 이벤트 카드와 URL hash를 통한 직접 진입

타임라인은 Shelter Signal V2가 이벤트 보존을 시작한 이후만 포함합니다.

### Deadline briefing

- D-Day, D-1, D-2, D-3 현재 공고
- 오늘 신규 긴급, 긴급 구간 진입, 종료일 앞당김 근거
- 지역·마감일 필터
- 설명 가능한 우선순위 상위 30건 표시
- 카드에서 공고 타임라인과 보호소 전화 연결

이 순위는 공식 위험 점수, 안락사 가능성, 입양 예측이 아닙니다.

## Cache, Fallback, And Observability

정규화된 live dataset은 server-side instance memory에 기본 300초 동안 캐시됩니다. `NOTICES_CACHE_TTL_SECONDS=0`으로 비활성화할 수 있고 최대 TTL은 600초입니다.

주요 metadata:

```text
source
fetchedAt
dateRange
pagesFetched
upstreamTotalCount
normalizedItemCount
returnedCount
totalFilteredCount
hasMore
nextPage
cacheStatus
cacheAgeSeconds
upstreamFetchDurationMs
fallbackReason
```

- usable stale-live 응답은 `source: api`를 유지
- live와 usable cache가 모두 없을 때만 fallback
- PostgreSQL, static JSON, mock fallback은 `source: fallback`과 경고 표시
- safe log에는 secret, full upstream URL, notice row 전체를 기록하지 않음

## Shelter Contact Context

`/api/shelters`는 구조동물 공고의 `careNm`, `careTel`, `careAddr`, `orgNm`을 정규화해 연락 맥락을 제공합니다. 별도의 완전한 공식 보호소 디렉터리는 아닙니다.

## Verification

Repository CI:

```powershell
npm run snapshot:check
npm run snapshot:test
npm run snapshot:dry-run
cd app
npm ci
npm run lint
npm run typecheck
npm run build
```

Production smoke test:

1. `#live`에서 Live API와 fallback 경계를 확인합니다.
2. `#changes`에서 수집 상태와 당일 event source를 확인합니다.
3. `#briefing`에서 D-Day~D-3 후보와 포함 근거를 확인합니다.
4. 변화 또는 브리핑 카드를 눌러 타임라인을 확인합니다.
5. `/api/notices?view=current&region=서울&limit=20`의 safe metadata를 확인합니다.

자세한 범위는 [VERIFY.md](VERIFY.md)와 [evidence index](docs/evidence/README.md)를 참고합니다.

## Evidence

Current:

- [V2 production verification · 2026-07-14](docs/evidence/v2-production-verification-2026-07-14.md)

Historical:

- [Live-first Production verification · 2026-06-15](docs/evidence/production-verification-2026-06-15.md)
- [Monthly snapshot dry-run · 2026-06-27](docs/evidence/monthly-snapshot-dry-run-2026-06-27.md)
- [Local V2 digest dry-run · 2026-06-19](docs/evidence/v2-dry-run-2026-06-19.md)

Historical PostgreSQL-primary screenshots and plans are retained as implementation history, not current Production evidence.

## Local Development

```powershell
cd app
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
```

Server-only environment variables:

```text
DATA_GO_KR_SERVICE_KEY=
DATABASE_URL=                 # optional fallback only
NOTICES_CACHE_TTL_SECONDS=300
```

`VITE_` prefix를 붙인 secret을 만들지 않으며 `.env`, `.vercel`, DB dumps, private exports를 commit하지 않습니다.

Optional local SQL and digest experiment:

```powershell
docker compose up -d
python scripts/validate_pipeline.py
python scripts/run_daily_digest_dry_run.py
```

이 로컬 digest는 실제 Production 알림 발송 근거가 아닙니다.

## Limitations

- 공공데이터 API 권한, quota, 지연, XML/plain-text 오류의 영향을 받습니다.
- 월별 snapshot은 실행 시점에 API가 반환한 관측이며 완전한 upstream history를 보장하지 않습니다.
- 최대 10페이지 cap 때문에 매우 큰 조회 범위는 잘릴 수 있으며 metadata에 `truncated`를 남깁니다.
- 기관별 공고·상태 갱신 주기가 실제 현장 상태와 다를 수 있습니다.
- `NOT_OBSERVED`와 `DISAPPEARED`는 입양·반환·이관·안락사·종료를 증명하지 않습니다.
- 공고별 타임라인은 2026-07-14 V2 이력 보존 시작 이후만 포함합니다.
- serverless memory cache는 cold start와 instance 간 공유를 보장하지 않습니다.
- 실제 사용자 계정, 구독, 외부 알림 발송, Production delivery monitoring, SLA는 구현하지 않았습니다.

## Repository Map

```text
app/api/                 # Vercel serverless routes
app/src/                 # V1 and V2 React product surfaces
app/public/data/         # public-safe snapshots, events, timelines, static fallback
sql/                     # optional local PostgreSQL models and tests
scripts/                 # collection, change detection, timeline and dry-run helpers
docs/                    # case study, schemas, roadmap, evidence, screenshots
.github/workflows/       # CI and scheduled snapshot automation
```
