# Archived Neon / Operational DB Plan

> Historical document: this is not the current Shelter Signal Production primary architecture.

## Current Status

Current Production uses a live-first read path:

```text
data.go.kr rescued-animal notice API
→ Vercel /api/notices
→ normalized cache and freshness filtering
→ React PWA
```

PostgreSQL/Neon can still be used as a server-side fallback when the live API fails, and local PostgreSQL remains useful for SQL modeling, static exports, and alert-candidate experiments. A successful PostgreSQL fallback is labeled `source: "fallback"` and must not be presented as live data.

## Previous Plan

An earlier V1.5 stage used the following primary read plan:

```text
Docker local PostgreSQL validation
→ Neon hosted PostgreSQL
→ Vercel /api/notices
→ React PWA
```

This stage proved that a Vercel Function could read `mart.animals_clean` through a server-only `DATABASE_URL` while keeping credentials out of browser code. The hosted validation rows were based on local mock/export data rather than current public notices.

## Historical Verification Evidence

Verified on 2026-06-05 during the previous operational DB stage:

```text
GET /api/notices?limit=100
source=operational-postgres
notices=20
```

Historical screenshots:

- [Operational DB badge](screenshots/08-operational-db-badge.png)
- [Operational notices API response](screenshots/09-api-notices-operational-response.png)

These screenshots are retained as implementation history only. They do not represent the current Production source or current UI status.

## Current Role Of PostgreSQL / Neon

- Optional server-side fallback after unusable live API collection
- Local reproducible pipeline and SQL model validation
- Static JSON export source
- Alert-candidate and digest dry-run experimentation

PostgreSQL/Neon is not required for a successful current live-first Production response.

## Secret Handling

Never commit, return, or log:

- `DATABASE_URL`
- Neon passwords or direct/pooled connection strings
- `DATA_GO_KR_SERVICE_KEY`
- `.env` files
- database dumps
- secret-bearing upstream URLs

For serverless PostgreSQL fallback, use a pooled connection string through the server-only `DATABASE_URL`. Do not expose it with a `VITE_` prefix.

## Historical Troubleshooting

The following codes relate only to the optional PostgreSQL fallback:

- `MISSING_DATABASE_URL`: no server-side fallback database is configured
- `DB_QUERY_ERROR`: the fallback database query failed

These errors do not prove that the live public API path is unavailable. Current operating status must be checked through `source`, `fallbackReason`, and the metadata described in [../VERIFY.md](../VERIFY.md).
