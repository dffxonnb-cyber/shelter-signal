# Shelter Signal App

Vite + React + TypeScript PWA for Shelter Signal V1.5. The app presents rescued-animal public notice data with priority cues, regional exploration, saved-notice placeholders, and shelter/contact context.

Production link: https://shelter-signal-ebon.vercel.app/

## Data Loading

The deployed app loads notice data in this order:

```text
/api/notices?limit=100
-> public/data/*.json static export fallback
-> src/data/mockAnimals.ts mock fallback
```

`/api/notices` is a Vercel serverless API route. It reads `DATABASE_URL` only on the server and queries the Neon PostgreSQL `mart.animals_clean` view. The browser never receives `DATABASE_URL` and never connects directly to the database.

If the route is unavailable, missing `DATABASE_URL`, returns `DB_QUERY_ERROR`, or returns an empty notices array, the frontend falls back to the static JSON export. If the static export also fails, it falls back to the local mock dataset so the portfolio PWA still renders.

Shelter/contact context is handled separately through `/api/shelters`. That route calls the data.go.kr rescued-animal notice API server-side and derives shelter summaries from notice fields such as `careNm`, `careTel`, `careAddr`, and `orgNm`. It is notice-derived context, not a complete official shelter directory.

## V1.5 Verified State

Shelter Signal V1.5 connects:

```text
Docker local PostgreSQL validation
-> Neon hosted PostgreSQL
-> Vercel /api/notices
-> React PWA
-> static JSON fallback
-> mock fallback
```

Verified deployment response:

```text
/api/notices?limit=100
ok=true
source=operational-postgres
notices=20
```

The current Neon dataset is based on local validation mock/export rows. Loading actual public-data rows into the hosted database is a separate V2+ task.

## Local Development

```powershell
npm install
npm run dev
npm run build
```

If `npm` is not available on PATH but dependencies are installed, these commands can be used for local build checks:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
```

## Vercel Settings

Deploy the `app` folder as the Vercel project root:

```text
Root Directory: app
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Required server-side environment variables:

```text
DATABASE_URL=
DATA_GO_KR_SERVICE_KEY=
```

`DATABASE_URL` is used only by `/api/notices`. `DATA_GO_KR_SERVICE_KEY` is used only by `/api/shelters`. Do not add a `VITE_` prefix to either value, because they must not be exposed to browser code.

## Troubleshooting

For `/api/notices`:

- `MISSING_DATABASE_URL`: the Vercel Function cannot see `DATABASE_URL`.
- `DB_QUERY_ERROR`: the function received a DB URL but could not query `mart.animals_clean`.
- Empty `notices`: the frontend treats the operational route as unusable and falls back to static JSON.

For `/api/shelters`:

- `MISSING_SERVICE_KEY`: the Vercel Function cannot see `DATA_GO_KR_SERVICE_KEY`.
- `UPSTREAM_ERROR`: the route called the upstream API but the response or permission state failed.
- `UPSTREAM_FORBIDDEN`: data.go.kr returned `403`; check service approval, operation path, required parameters, key encoding, and accidental whitespace.
- Direct check: https://shelter-signal-ebon.vercel.app/api/shelters
- Local diagnosis: `python scripts/test_shelter_upstream_request.py`

## Current Product Boundary

The app includes a landing view, golden-time priority view, notice filtering, region exploration, a notice detail sheet, and shelter contact guidance.

Auth, real email/SMS alerts, n8n production automation, subscription management, and production monitoring are intentionally out of scope. V2/n8n work is limited to digest preview and dry-run verification.
