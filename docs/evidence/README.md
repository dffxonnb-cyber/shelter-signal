# Shelter Signal Production Evidence

이 폴더는 Shelter Signal의 현재 live-first V1과 history-aware V2 상태를 확인한 public-safe evidence를 보관합니다.

## Current Evidence

Evidence date: 2026-07-14 KST

- [V2 Production verification](v2-production-verification-2026-07-14.md)
- Generated public-safe snapshot metadata: `app/public/data/latest-notices.meta.json`
- Daily change events: `app/public/data/daily-events/2026-07-14.json`
- Cumulative notice timelines: `app/public/data/notice-timelines.json`

Verified current path:

- live public API snapshot collection
- scheduled workflow configuration and manual recovery path
- previous/current comparison
- daily event preservation
- missing-state boundary
- cumulative timeline bootstrap and deduplication
- today-change dashboard
- deadline briefing
- repository CI and Vercel deployment

The first next-day automatic schedule execution remains a follow-up operational check.

## Historical Live-first Evidence

Evidence date: 2026-06-15 KST

- [Production verification summary](production-verification-2026-06-15.md)
- [Safe Production API metadata](production-api-metadata-2026-06-15.json)
- [GitHub Actions Verify result](github-actions-verify-2026-06-15.json)
- [Production UI screenshot](../screenshots/10-live-first-production-ui-2026-06-15.png)

This evidence covers the V1 live-first API, freshness, cache, fallback, and secret boundary before the V2 history layer was added.

## Historical Snapshot Dry-run Evidence

Evidence date: 2026-06-27 KST

- [Monthly snapshot workflow dry-run](monthly-snapshot-dry-run-2026-06-27.md)

This earlier evidence documents the manual dry-run path before live daily preservation was activated. It is retained as implementation history, not current snapshot capability.

## Historical V2 Digest Dry-run

Evidence date: 2026-06-19 KST

- [Local V2 digest dry-run](v2-dry-run-2026-06-19.md)

This evidence documents local alert candidate and digest preview generation. It is not Production notification evidence and is not required for the current V2 product baseline.

## Current Evidence Boundary

Current evidence confirms:

- Production V1 can expose live/cache/fallback state
- public API snapshot collection completed successfully
- generated snapshot and metadata are public-safe
- same-day recovery runs do not erase earlier events
- `NOT_OBSERVED` and `DISAPPEARED` remain observation states
- cumulative notice timeline generation and deduplication work
- V2 change dashboard and deadline briefing compile and deploy
- GitHub Actions Verify passes without Production secrets

Current evidence does not confirm:

- complete upstream dataset history or perfect accuracy
- exact agreement with every shelter's field state
- a final outcome for a missing notice
- all region, date, page-cap, and fallback combinations
- the first next-day automatic schedule execution
- real email, SMS, push, recipient, subscription, monitoring, or SLA

## Public-safe Policy

- Evidence documents may include aggregate counts, timestamps, file paths, CI results, and public repository links.
- Do not include service keys, `.env`, `DATABASE_URL`, tokens, SMTP credentials, real recipients, or full secret-bearing upstream URLs.
- A missing public notice must not be described as proof of adoption, return, transfer, euthanasia, or closure.
- Deadline briefing must be described as an explainable review order, not an official danger score or outcome prediction.

## Historical Operational DB Evidence

과거 PostgreSQL-primary 검증 캡처는 [screenshots README](../screenshots/README.md)의 Historical Operational DB Evidence에 별도로 분류되어 있습니다. 해당 자료는 현재 Production architecture evidence가 아닙니다.
