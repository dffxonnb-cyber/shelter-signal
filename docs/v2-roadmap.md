# Shelter Signal V2 Roadmap

## V1.5 Baseline

Shelter Signal `main` is stabilized at `v1.5.0`.

Completed baseline:

- Docker local PostgreSQL pipeline validation
- Neon hosted PostgreSQL connection
- Vercel `/api/notices` operational read path
- `/api/notices?limit=100` verified with `ok=true`, `source=operational-postgres`, `notices=20`
- React PWA Operational DB badge
- static JSON fallback
- mock fallback
- Vercel `/api/shelters` notice-derived shelter/contact route
- README, Neon deployment docs, portfolio case study, and verification screenshots

Current Neon data is based on local mock/export validation rows. Loading actual public-data rows into the hosted DB is a separate V2+ task.

## V2 Definition

Shelter Signal V2 is a preview-only alert pipeline validation track.

The goal is to verify:

```text
Docker PostgreSQL
-> SQL models
-> mart.alert_candidates
-> daily digest JSON/HTML preview
-> local dry-run script
-> optional local n8n HTTP dry-run bridge
```

This is not a production notification service. It does not send real email and does not manage real subscribers.

## Scope For This Branch

The `v2/n8n-email-alerts` branch should preserve the `main`/`v1.5.0` app architecture while keeping digest preview materials.

Allowed V2 scope:

- `mart.alert_candidates` SQL view
- daily digest preview export
- dry-run script
- local HTTP bridge for n8n HTTP Request testing
- n8n workflow documentation for manual/local dry-run
- generated preview verification
- optional local-only Mailpit/manual test files if already present, kept clearly out of production scope

Out of scope:

- real external email sending
- SMTP/Gmail credentials
- real recipients
- subscription management
- auth
- SMS
- push notifications
- production monitoring
- activated production n8n schedule
- automatic deployment from n8n

## Required Revalidation

Run after syncing this branch with `main`:

```powershell
python scripts/validate_pipeline.py
python scripts/run_daily_digest_dry_run.py
cd app
npm.cmd run build
```

`python scripts/validate_pipeline.py` should verify:

- Docker availability
- PostgreSQL readiness
- migrations
- mock data load
- SQL models
- SQL tests
- `mart.alert_candidates` preview

`python scripts/run_daily_digest_dry_run.py` should verify:

- DB connection
- `mart.alert_candidates` exists
- candidate count can be queried
- preview JSON is generated
- preview HTML is generated
- no email is sent

Expected generated files:

```text
data/exports/email_digest_preview.json
data/exports/email_digest_preview.html
```

Generated preview files must remain uncommitted.

## n8n Dry-Run Direction

n8n is local/manual preview only.

Recommended local flow:

```text
n8n Manual Trigger
-> HTTP Request to local dry-run bridge
-> python scripts/run_daily_digest_dry_run.py
-> preview JSON/HTML generated locally
-> inspect result in n8n execution output
```

The local bridge remains:

```powershell
python scripts/serve_daily_digest_dry_run.py
```

Typical n8n HTTP Request target:

```text
POST http://host.docker.internal:8787/dry-run
```

Optional HTML payload testing:

```text
POST http://host.docker.internal:8787/dry-run?include_html=true
```

This still does not send email. It only returns generated preview HTML to the local n8n workflow.

## Relationship To Neon And Vercel

Neon/Vercel operational DB read path is part of V1.5:

```text
Neon PostgreSQL
-> Vercel /api/notices
-> React PWA
```

V2 digest preview is a separate local pipeline validation:

```text
Docker PostgreSQL
-> mart.alert_candidates
-> preview JSON/HTML
-> optional n8n dry-run
```

Do not mix these responsibilities:

- Vercel `/api/notices` proves the deployed app can read operational notice data.
- V2 dry-run proves alert candidate selection and digest rendering can be generated locally.
- Real public-data ingestion into Neon is a later task.
- Real notification delivery is a later task.

## Safety Boundaries

- Do not commit `DATABASE_URL`, Neon passwords, service keys, SMTP credentials, OAuth tokens, or real recipient addresses.
- Do not print secrets in logs.
- Do not use Gmail OAuth, Google Cloud OAuth, Gmail SMTP, or app passwords for this branch.
- Do not activate schedules or publish a production n8n workflow.
- Do not treat Mailpit or local preview as external delivery readiness.
- Keep generated files under `data/exports/` out of Git.
- Keep V1.5 operational DB read path and fallback architecture intact.

## Future Work

V2+ candidates:

- actual public-data ingestion into hosted Neon DB
- hosted DB refresh strategy
- saved notices
- alert subscription design
- consented recipient management
- unsubscribe and bounce handling
- production email provider evaluation
- production monitoring
