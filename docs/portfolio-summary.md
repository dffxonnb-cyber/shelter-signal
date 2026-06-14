# Shelter Signal Portfolio Summary

## Project

**Shelter Signal | 공공데이터 기반 구조동물 공고 탐색 PWA**

Production: https://shelter-signal-ebon.vercel.app/

## One-line Description

구조동물 공고의 종료일과 데이터 출처를 기준으로 현재·종료 임박·보호·기록 상태를 분리하고, live/cache/fallback 상태를 명확히 보여주는 public-data service입니다.

## Current Production Architecture

```text
data.go.kr live notice API
→ Vercel /api/notices
→ normalized server cache
→ KST freshness and urgency classification
→ server-side region/view/page filtering
→ React PWA
```

PostgreSQL, static JSON, and mock data are fallback or local validation paths. They are not the current primary Production source.

## Key Technical Points

- KST rolling 30-day upstream collection
- `noticeEdt`-based expired and missing-deadline filtering
- `days_left` and `D-Day`~`D-3` urgency classification
- `current`, `urgent`, `protected`, `archive` views
- Korean region alias matching and page/limit pagination
- 5-minute normalized live-data cache and in-flight request sharing
- explicit `source`, cache, fallback, empty-state, and pagination metadata
- server-only public API key and safe structured logs

## Verification Boundary

Repository CI runs lint, typecheck, and build without secrets or external API calls. Manual Production smoke testing checks the UI and safe `/api/notices` metadata to confirm live operating status.

The smoke test does not claim full upstream dataset completeness or public-service impact.

## Historical Evidence

`08-operational-db-badge.png` and `09-api-notices-operational-response.png` document an earlier PostgreSQL-primary deployment stage. They are historical evidence and must not be presented as the current Production architecture.

## Boundaries

- Portfolio prototype, not a production shelter service
- Notice-derived contact context, not a complete official shelter directory
- No user accounts, persisted saves, real notifications, monitoring, or SLA
- Public API quota, response format, update cycle, and page-cap limitations remain
- No secret values, service keys, connection strings, or real recipient data are committed
