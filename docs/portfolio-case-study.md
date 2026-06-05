# Shelter Signal Portfolio Case Study

## Project Summary

Shelter Signal is a portfolio-ready mobile PWA prototype that reorganizes public rescued-animal notices into a clearer priority and contact workflow.

The project uses public data, a local PostgreSQL/SQL modeling pipeline, Neon hosted PostgreSQL, a Vite React PWA, and Vercel serverless API routes. V1.5 focuses on helping reviewers understand how public-sector data can become a usable data product surface without exposing database credentials or API keys in browser code.

Live app: https://shelter-signal-ebon.vercel.app/

One-line summary:

> A public-data PWA that helps users identify rescued-animal notices to check first and see notice-derived shelter contact context.

## Problem

Rescued-animal notices contain important information such as notice end dates, region, shelter names, phone numbers, addresses, animal type, and photo availability. In the raw notice format, those fields are scattered and hard to scan quickly.

The product question was:

> How can a user quickly understand which notices deserve attention first, and what official contact context is available?

The project also needed to handle practical data constraints:

- Public API access can be inconsistent or permission-limited.
- API keys must not be exposed in frontend code.
- A portfolio demo should continue to render even when live data is unavailable.
- Shelter contact information should not be overstated as a complete official directory.

## My Approach

I treated Shelter Signal as a small data product rather than a simple list UI.

The approach was to separate responsibilities:

- Use Python and PostgreSQL for local ingestion and modeling.
- Use SQL views to produce explainable summary data.
- Validate the data pipeline locally with Docker Compose PostgreSQL.
- Use Neon PostgreSQL as the hosted operational read database for the deployed app.
- Use Vercel `/api/notices` so the browser never connects directly to the database.
- Keep static JSON and mock data as safe fallbacks when the DB route fails.
- Use a Vercel serverless route for live shelter/contact lookup.
- Keep public-data API secrets server-side with `DATA_GO_KR_SERVICE_KEY`.

This lets the deployed app stay simple, inspectable, and stable while demonstrating a full data-product path: local validation, hosted operational DB read, serverless API boundary, frontend normalization, and fallback UX.

## What I Built

Shelter Signal V1 includes:

- Mobile-first Vite React PWA
- Home signal overview
- Golden Time list for `긴급 확인` and `곧 종료` notices
- Rescue Window Score display and sorting
- Notice filters by signal, animal type, and region
- Notice display count control
- Region explorer with 시/도 and 시/군/구 selectors
- Vercel `/api/notices` route connected to Neon-backed operational PostgreSQL reads
- Vercel `/api/shelters` route for notice-derived shelter contact summaries
- Detail sheet with official notice fields, animal information, shelter contact fields, and contact actions
- Saved-notice placeholder for a later persistence phase
- PWA manifest, service worker, SVG icon, and OG image assets
- Portfolio screenshots and deployment documentation

## Data Pipeline

V1.5 uses an operational DB read path as the primary app data source:

```text
Public API / mock data
→ PostgreSQL raw table
→ SQL models and tests
→ Rescue Window Score
→ Neon hosted PostgreSQL
→ Vercel /api/notices
→ Vite React PWA
```

Local validation still uses Docker Compose PostgreSQL for migrations, mock data load, SQL models, SQL tests, and app JSON export validation. In the deployed environment, Neon PostgreSQL and a Vercel API route provide the operational read path.

The fallback path remains:

```text
/api/notices failure or empty result
→ static JSON export
→ mock fallback
```

The fallback files are:

```text
app/public/data/animals.json
app/public/data/region_summary.json
app/public/data/rescue_window_summary.json
app/public/data/shelter_summary.json
app/public/data/kind_summary.json
```

Verified V1.5 deployment state:

```text
/api/notices?limit=100
ok=true
source=operational-postgres
notices=20
```

The current hosted Neon data is based on local validation mock/export data. Actual public-data rows in the hosted DB are a later step.

Shelter/contact lookup uses a separate server-side route:

```text
PWA region selector
→ /api/shelters
→ Vercel Serverless Function
→ data.go.kr rescued-animal notice API
→ careNm/careTel/careAddr/orgNm dedupe
→ frontend shelter contact cards
```

The browser never connects directly to PostgreSQL or data.go.kr. The service key is read only by the serverless function.

## Key Decisions

**Operational DB first, fallback always available**

The PWA now calls `/api/notices?limit=100` first. If the DB route fails, returns `ok=false`, or returns an empty notices array, the app falls back to static JSON and then mock data. This prevents the portfolio app from breaking while still proving a deployed operational DB read path.

**Docker locally, Neon in deployment**

로컬에서는 Docker Compose PostgreSQL로 데이터 파이프라인을 검증하고, 배포 환경에서는 Neon PostgreSQL과 Vercel API route를 통해 operational read path를 구성했다.

**DB failure does not break the app**

DB route가 실패해도 static JSON과 mock fallback으로 앱이 깨지지 않도록 설계했다.

**Server-only public API key**

The frontend calls `/api/shelters`; it never receives or stores the public-data service key. The Vercel function reads `DATA_GO_KR_SERVICE_KEY` from the deployment environment.

**Server-only database URL**

The frontend calls `/api/notices`; it never receives or stores `DATABASE_URL`. The Vercel function reads the Neon pooled connection string only from the deployment environment.

**Notice-derived shelter summaries**

The shelter list is not presented as a complete official shelter directory. It is derived from rescued-animal notice fields already present in API rows: `careNm`, `careTel`, `careAddr`, and `orgNm`.

**Explainable priority signal**

Rescue Window Score is an internal exploration signal, not an official risk score or adoption prediction. The UI and documentation avoid claiming legal, medical, or public-agency status.

**V1/V2 separation**

V1 stays focused on the PWA and shelter lookup. V2 planning explores n8n, digest preview, and alert candidates without changing V1 into an unfinished production notification service.

## Technical Stack

- Vite
- React
- TypeScript
- Vercel Functions
- Python
- PostgreSQL
- Neon PostgreSQL
- SQL migrations, models, and tests
- Docker Compose
- Static JSON export
- PWA manifest and service worker
- SVG app and Open Graph assets

## Limitations

Shelter Signal V1 is not a production shelter service.

Current limitations:

- No user accounts or authentication
- No persisted saved notices
- No push notifications
- No real email or SMS delivery
- No production n8n automation
- No production monitoring
- No map SDK
- No shelter homepage, operating-hours, or coordinate enrichment
- No claim that notice-derived shelter summaries are a complete official directory
- Rescue Window Score is not an official risk score or outcome prediction
- Current Neon data is based on local mock/export validation data, not live hosted public-data ingestion

## V2 Roadmap

V2 is planned around an n8n/email digest pipeline, but it remains outside the V1 production surface.

Next V2 steps:

- Sync `v2/n8n-email-alerts` with the latest `main` branch changes.
- Load actual public-data rows into the hosted database path after reviewing API permissions and data refresh strategy.
- Revalidate `python scripts/run_daily_digest_dry_run.py`.
- Continue digest preview work from the `mart.alert_candidates` view.
- Keep production auth, subscription management, real email/SMS sending, and monitoring out of scope until the preview workflow is reviewed.

## Portfolio Description

Shelter Signal is a public-data rescued-animal notice PWA that turns scattered notice fields into a clearer priority and contact workflow. I built the project as an end-to-end data product prototype: Python ingestion, PostgreSQL modeling, SQL tests, Docker local validation, Neon hosted read path, React PWA screens, and Vercel serverless API routes that keep database credentials and public-data keys out of browser code.

The strongest portfolio points are the product framing, data analysis-to-product translation, explainable Rescue Window Score, Docker-to-Neon deployment path, fallback architecture, and server-side API boundaries.
