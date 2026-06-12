# Shelter Signal Portfolio Summary

## Project Title

Shelter Signal

Production link: https://shelter-signal-ebon.vercel.app/

## Portfolio Card Copy

Shelter Signal is a portfolio-ready PWA prototype that turns rescued-animal public notices into a prioritized, mobile-first review experience with shelter/contact context.

## V1.5 Summary

Shelter Signal V1.5 is a public-data-based rescued-animal notice PWA with a verified operational database read path.

The deployed app reads notice data through:

```text
Neon PostgreSQL
-> Vercel /api/notices
-> React PWA
-> static JSON fallback
-> mock fallback
```

Verified deployment state:

```text
/api/notices?limit=100
ok=true
source=operational-postgres
notices=20
```

The current hosted data is based on local validation mock/export rows. Loading actual public-data rows into the hosted DB is a later step.

Shelter contact context is handled separately through `/api/shelters`, which calls the data.go.kr rescued-animal notice API server-side and derives contact summaries from `careNm`, `careTel`, `careAddr`, and `orgNm`.

## V2 Digest Preview Scope

V2/n8n work is limited to local preview and dry-run validation.

It may include:

- `mart.alert_candidates` SQL candidate view
- daily digest JSON/HTML preview
- local dry-run script
- local HTTP bridge for n8n HTTP Request testing
- optional local-only Mailpit/manual test artifacts if already present

It does not include:

- real external email sending
- SMTP/Gmail credentials
- real recipients
- subscriptions
- auth
- SMS
- push notifications
- production monitoring
- activated production n8n schedules

## Screenshot References

- Landing hero: `docs/screenshots/01-landing-hero.png`
- App preview: `docs/screenshots/02-app-preview-home.png`
- Golden time: `docs/screenshots/03-golden-time.png`
- Notice filter: `docs/screenshots/04-notices-filter.png`
- Region explorer: `docs/screenshots/05-region-explorer.png`
- Detail sheet: `docs/screenshots/06-detail-sheet.png`
- Data pipeline: `docs/screenshots/07-data-pipeline.png`
- Operational DB badge: `docs/screenshots/08-operational-db-badge.png`
- `/api/notices` operational response: `docs/screenshots/09-api-notices-operational-response.png`

## Technical Stack

- Python
- PostgreSQL
- Docker Compose
- Neon PostgreSQL
- SQL migrations, models, and tests
- Static JSON export
- Vercel serverless API routes
- Vite
- React
- TypeScript
- PWA metadata and SVG brand assets
- n8n preview/dry-run documentation

## Key Contribution

This project connects data analysis, data modeling, backend API boundaries, and frontend product design into one portfolio artifact. It is not a generic CRUD demo: it defines a Rescue Window Score, models alert candidates in SQL, exports app-ready JSON, serves operational data through a serverless route, and keeps graceful fallbacks for portfolio reliability.

In V1.5, the local Docker validation path and the hosted Neon read path are separated on purpose. That separation shows both data pipeline discipline and deployed product behavior without exposing database credentials to the browser.

## Why This Project Matters

Shelter Signal turns public notices from a passive lookup table into a decision-support interface. Reviewers can quickly see which notices are time-sensitive, where they are concentrated, and what shelter/contact context is available.

The project also demonstrates practical constraints: public API permissions, imperfect source data, secret handling, operational DB failures, and fallback design.

## Boundaries

- Shelter Signal is not a production shelter service.
- The shelter/contact summaries are notice-derived, not a complete official shelter directory.
- Rescue Window Score is an internal exploration signal, not an official risk score or prediction model.
- Current Neon data is mock/export based and contains 20 validation rows.
- Actual public-data ingestion into the hosted DB is a future task.
- V2 digest work is preview/dry-run only.
- Real email/SMS/push/auth/subscription/monitoring are intentionally not implemented.
- Secrets such as `DATABASE_URL`, Neon passwords, service keys, email credentials, and real recipients must never be committed or logged.
