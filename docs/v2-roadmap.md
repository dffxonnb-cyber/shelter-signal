# Shelter Signal V2 Roadmap

## V2 One-Line Definition

Shelter Signal V2 is a planned n8n-based alert pipeline that refreshes rescued-animal notice data, selects notice candidates from SQL, and generates a preview-only daily email digest.

V2 is not production-ready. It is a follow-up pipeline and automation track that builds on the V1 portfolio PWA without changing V1 into a live notification service.

## Current Branch Note

V1 is stabilized on `main` as a portfolio-ready PWA prototype.

V2 work is separated on:

```text
v2/n8n-email-alerts
```

Before continuing V2 implementation, sync `v2/n8n-email-alerts` with the latest `main` branch. `main` contains V1 live shelter API improvements, portfolio documentation polish, and the current Vercel `/api/shelters` behavior. The V2 branch should be updated before additional workflow, Mailpit, or digest work continues.

## V1 And V2 Boundary

| Area | V1 current state | V2 planned direction |
| --- | --- | --- |
| App purpose | Portfolio PWA for rescued-animal notice priority and shelter contact context | Pipeline/digest automation layer |
| Primary app data | Static JSON export in `app/public/data/*.json` | Static JSON may be refreshed later, but not required initially |
| Live route | `/api/shelters` notice-derived contact summaries | `/api/notices` operational route verification |
| Alerting | Not implemented | Preview-only email digest from SQL candidates |
| Production readiness | Portfolio prototype | Still not production notification infrastructure |

V2 must preserve V1's current positioning: Shelter Signal is not an official shelter service, not a risk prediction system, and not a production notification platform.

## Required Revalidation

After syncing the V2 branch with `main`, run the local pipeline checks again.

### 1. Docker Desktop

Start Docker Desktop before running data pipeline commands. The local PostgreSQL service depends on Docker Compose.

```powershell
docker compose up -d postgres
```

If host port `5432` is already in use, set `POSTGRES_PORT=5433` before starting the service.

```powershell
$env:POSTGRES_PORT = "5433"
docker compose up -d postgres
```

### 2. Pipeline Validation

Run:

```powershell
python scripts/validate_pipeline.py
```

This should verify:

- Docker availability
- PostgreSQL readiness
- SQL migrations
- mock data loading
- SQL models
- SQL tests
- preview queries for `mart.alert_candidates`, `mart.region_summary`, `mart.shelter_summary`, and related views

This check should pass before treating the V2 branch as ready for more automation work.

### 3. Daily Digest Dry-Run

Run:

```powershell
python scripts/run_daily_digest_dry_run.py
```

This should verify:

- PostgreSQL connection
- `mart.alert_candidates` exists
- candidate count can be queried
- preview JSON is written
- preview HTML is written
- no email is sent

Expected generated files:

```text
data/exports/email_digest_preview.json
data/exports/email_digest_preview.html
```

These generated preview files should remain uncommitted.

### 4. Operational Notices Route

The experimental `/api/notices` route should be verified separately from the V1 static JSON app path.

Route intent:

- Read `DATABASE_URL` only from the server/deployment environment.
- Query the operational PostgreSQL view `mart.animals_clean`.
- Return notice rows in a shape close to the static `animals.json` export.
- Keep database secrets out of browser code.

This route is not yet the primary PWA data source. V1 still reads static JSON first and falls back to mock data.

## Alert Candidates And Digest Preview

The V2 digest should be based on the SQL view:

```text
mart.alert_candidates
```

The current alert candidate logic is designed to select notice-level rows using:

- active notice status
- days until notice end
- `긴급 확인` and `곧 종료` Rescue Window labels
- Rescue Window Score
- fallback top-scored notices when direct candidates are too few

The email digest preview should stay preview-only until candidate quality, wording, and safety constraints are reviewed.

Preview output should include:

- generated timestamp
- candidate count
- notice number
- animal kind and region
- shelter name and contact fields when available
- notice end date
- Rescue Window Score
- alert reason
- official contact reminder
- preview-only notice

## n8n Direction

Initial n8n work should remain local and non-sending.

Recommended local flow:

```text
n8n Manual Trigger
→ HTTP Request to local dry-run bridge
→ python scripts/run_daily_digest_dry_run.py
→ preview JSON/HTML generated locally
→ inspect result in n8n execution output
```

The local bridge remains:

```powershell
python scripts/serve_daily_digest_dry_run.py
```

The n8n HTTP Request node can call:

```text
POST http://host.docker.internal:8787/dry-run
```

When HTML body testing is needed later, the bridge can include the generated HTML without sending email:

```text
POST http://host.docker.internal:8787/dry-run?include_html=true
```

## Out Of Scope For V2 Foundation

These are intentionally outside the current V2 foundation scope:

- production auth
- user accounts
- subscription management
- real email sending
- real SMS sending
- push notifications
- unsubscribe flow
- bounce handling
- sender reputation management
- production monitoring
- production incident alerting
- public admin dashboard
- automatic production deployment from n8n

The first V2 target is digest preview correctness, not user-facing notification delivery.

## Safety And Product Constraints

- Shelter Signal is not an official risk scoring or adoption prediction system.
- Rescue Window Score is an internal exploration signal only.
- Digest language should avoid fear, guilt, or certainty about outcomes.
- Official contact and final confirmation should always be directed to shelters or public agencies.
- API keys, DB passwords, SMTP credentials, OAuth tokens, and real recipients must not be committed.
- Failed V2 automation must not break the deployed V1 static PWA.

## Practical Next Steps

1. Sync `v2/n8n-email-alerts` with latest `main`.
2. Start Docker Desktop.
3. Run `python scripts/validate_pipeline.py`.
4. Run `python scripts/run_daily_digest_dry_run.py`.
5. Verify `/api/notices` locally or in a controlled deployment environment with `DATABASE_URL`.
6. Review generated `email_digest_preview.json` and `email_digest_preview.html`.
7. Keep email sending disabled until preview quality and safety language are approved.
8. Decide later whether static JSON refresh should remain manual or become part of a controlled V2 workflow.
