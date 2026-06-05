# Neon Deployment Notes

## Purpose

This document records the Shelter Signal V1.5 operational database read path:

```text
Docker local PostgreSQL validation
→ Neon hosted PostgreSQL
→ Vercel /api/notices
→ React PWA primary data source
→ static JSON fallback
→ mock fallback
```

No raw connection strings, database passwords, service keys, or secrets are included here.

## Roles

### Local Docker PostgreSQL

Docker Compose remains the local validation environment.

It is used for:

- applying migrations
- loading mock or API-shaped test data
- building SQL models
- running SQL tests
- validating `mart.animals_clean`
- validating `mart.alert_candidates`
- exporting app JSON files into `app/public/data/*.json`

The local Docker database is the reproducible development and QA path. It is not reachable by Vercel in production.

### Neon PostgreSQL

Neon PostgreSQL is the hosted database used by the deployed app's operational read path.

It is used for:

- hosting the PostgreSQL schema and views needed by `/api/notices`
- letting Vercel Functions query `mart.animals_clean`
- proving that the deployed portfolio app can read from a hosted operational DB

Current data note:

- The deployed Neon database currently contains 20 rows based on local validation mock/export data.
- Loading actual public-data rows into the hosted DB is a later step.

### Vercel `/api/notices`

The browser never connects directly to Neon.

The deployed frontend calls:

```text
/api/notices?limit=100
```

The Vercel serverless route reads `DATABASE_URL` from the deployment environment and queries:

```text
mart.animals_clean
```

The route returns normalized notice records to the React PWA. If this route fails, the frontend falls back to static JSON and then mock data.

## Connection Strings

Neon provides different connection string styles. Keep both secret.

### Direct Connection String

Use the direct connection string for database maintenance tasks such as:

- `psql` checks
- schema inspection
- dump/restore
- one-time data copy

This is useful for local operations where a long-running direct database connection is acceptable.

### Pooled Connection String

Use the pooled connection string for:

- Vercel `DATABASE_URL`
- serverless runtime access
- short-lived function invocations

Shelter Signal's Vercel `DATABASE_URL` is configured with the Neon pooled connection string.

Do not commit either connection string.

## Verified Deployment State

Verified on 2026-06-05:

```text
GET https://shelter-signal-ebon.vercel.app/api/notices?limit=5
ok=true
source=operational-postgres
```

```text
GET https://shelter-signal-ebon.vercel.app/api/notices?limit=100
ok=true
source=operational-postgres
notices=20
```

The deployed React PWA bundle includes `/api/notices?limit=100` as the primary notice source and shows the `Operational DB · 20건` badge when the operational route succeeds.

Verification screenshots:

- [Operational DB badge](screenshots/08-operational-db-badge.png)
- [Operational notices API response](screenshots/09-api-notices-operational-response.png)

The API response screenshot shows public JSON response fields only. It does not include database passwords, connection strings, or service keys.

## Fallback Behavior

The frontend fallback order is:

```text
/api/notices?limit=100
→ app/public/data/*.json
→ src/data/mockAnimals.ts
```

Fallback cases include:

- `/api/notices` returns a non-2xx response
- `/api/notices` returns `ok=false`
- `MISSING_DATABASE_URL`
- `DB_QUERY_ERROR`
- `notices` is missing or not an array
- `notices` is an empty array
- static JSON fetch failure

This keeps the deployed portfolio app reviewable even when the hosted DB path is unavailable.

## Troubleshooting

### `MISSING_DATABASE_URL`

The Vercel Function cannot see `DATABASE_URL`.

Check:

- the environment variable name is exactly `DATABASE_URL`
- the variable is enabled for the intended Vercel environment
- the value uses the Neon pooled connection string for serverless runtime use
- production was redeployed after changing the variable

Do not print the value in logs.

### `DB_QUERY_ERROR`

The Vercel Function has a database URL, but the query failed.

Check:

- Neon project is active
- the schema exists
- `mart.animals_clean` exists
- the connection user has read access
- the selected database contains the expected validation data

Do not log connection strings, passwords, or full environment dumps.

### Static Export Fallback

If the badge shows `Static export fallback`, the frontend did not use operational DB data.

Likely causes:

- `/api/notices` failed
- hosted DB returned an empty notices array
- Vercel deployment is still using an old build
- browser cache is showing an older asset

Static fallback is expected to keep the app working, but the operational route should be checked separately.

## Secret Handling

Never expose these in README, docs, screenshots, issue comments, commit messages, or logs:

- `DATABASE_URL`
- Neon password
- Neon direct connection string
- Neon pooled connection string
- `DATA_GO_KR_SERVICE_KEY`
- public-data service keys
- local `.env` files
- raw database dumps

Local dump files such as `*.dump` should remain uncommitted.

## V1.5 Definition

Shelter Signal V1.5 means:

```text
Docker local DB validation
+ Neon hosted operational PostgreSQL
+ Vercel /api/notices read path
+ React PWA primary operational source
+ static JSON and mock fallback architecture
```

V2 candidates remain separate:

- actual public-data ingestion into hosted DB
- saved notices
- alert subscription
- n8n digest preview
- production monitoring
