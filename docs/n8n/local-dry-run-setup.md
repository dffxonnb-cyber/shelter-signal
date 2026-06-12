# n8n Local Dry-Run Setup

This guide connects Shelter Signal V2's daily digest dry-run command to a local n8n workflow. It is generation-only: n8n calls a local preview command, verifies that preview files are created, and stops before any real email sending.

## V1.5 Baseline

This branch should stay synced with the `main`/`v1.5.0` architecture:

```text
Neon PostgreSQL
-> Vercel /api/notices
-> React PWA
-> static JSON fallback
-> mock fallback
```

The deployed operational DB read path is separate from the V2 digest preview path. n8n does not replace `/api/notices`, does not write to Neon, and does not act as a production notification backend in this stage.

## What This Stage Proves

The local n8n dry-run verifies this path:

```text
Docker PostgreSQL
-> mart.alert_candidates
-> scripts/run_daily_digest_dry_run.py
-> preview JSON/HTML
-> optional n8n HTTP Request result
```

Generated files:

```text
data/exports/email_digest_preview.json
data/exports/email_digest_preview.html
```

These files can contain live-like local data, so they remain ignored by Git.

## Primary Verification

From the repository root on `v2/n8n-email-alerts`:

```powershell
docker compose up -d postgres
python scripts/validate_pipeline.py
python scripts/run_daily_digest_dry_run.py
```

Expected dry-run result:

- database connection PASS
- `mart.alert_candidates` exists
- alert candidate count is available
- preview JSON export PASS
- preview HTML export PASS
- no email sent

Mailpit and manual email capture files may remain in this branch as local-only artifacts, but they are not required for this sync and are not production delivery proof.

## Local Prerequisites

- Docker Desktop running
- Docker Compose available as `docker compose`
- PostgreSQL started from this repository's `docker-compose.yml`
- Python available as `python` or `py -3`
- optional local n8n instance for manual workflow testing
- no Gmail, external SMTP credentials, real recipients, SMS, auth, user accounts, or API keys in the workflow

The current Compose file starts PostgreSQL and Mailpit. It intentionally does not start n8n. The dry-run command needs repository access, local Python, Docker Compose, and the running Postgres service, so host n8n plus the local HTTP bridge is the simplest test shape.

## PostgreSQL And Port Handling

Start PostgreSQL:

```powershell
docker compose up -d postgres
docker compose ps
```

The default host port is `5432`:

```yaml
ports:
  - "${POSTGRES_PORT:-5432}:5432"
```

If local port `5432` is busy, bind Postgres to host port `5433` before starting the service:

```powershell
$env:POSTGRES_PORT = "5433"
docker compose up -d postgres
```

The container still listens on `5432`; only the host binding changes.

## HTTP Bridge

Some local n8n setups do not expose a usable Execute Command node. The local HTTP bridge lets n8n use a standard HTTP Request node instead.

Start the bridge from the repository root:

```powershell
python scripts/serve_daily_digest_dry_run.py
```

It listens on local loopback by default:

```text
http://127.0.0.1:8787
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Run dry-run through HTTP:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8787/dry-run
```

If n8n runs in Docker, use the host bridge address:

```text
POST http://host.docker.internal:8787/dry-run
```

For HTML payload inspection only:

```text
POST http://host.docker.internal:8787/dry-run?include_html=true
```

The `include_html=true` response includes generated preview HTML for inspection. It still sends no email.

## n8n Workflow Drafts

Recommended HTTP Request draft:

```text
docs/n8n/daily-digest-http-dry-run.workflow.json
```

Optional legacy Execute Command draft:

```text
docs/n8n/daily-digest-dry-run.workflow.json
```

Optional local Mailpit outline:

```text
docs/n8n/manual-test-email.workflow.json
```

The recommended V2 verification is the dry-run script and HTTP bridge. The Mailpit outline is only for one-message local capture experiments and should not be treated as external email readiness.

## Expected HTTP Response

Successful dry-run response shape:

```json
{
  "status": "ok",
  "dry_run_result": {
    "result": "PASS",
    "db_connection_status": "PASS",
    "alert_candidates_status": "PASS",
    "json_export_status": "PASS data/exports/email_digest_preview.json",
    "html_export_status": "PASS data/exports/email_digest_preview.html"
  },
  "alert_candidate_count": 5,
  "message": "PASS daily digest preview dry-run complete. No email was sent."
}
```

This confirms preview generation only.

## Safety Rules

- Do not commit `DATABASE_URL`, Neon passwords, service keys, SMTP credentials, OAuth tokens, or real recipient addresses.
- Do not add Gmail OAuth, Google Cloud OAuth, Gmail SMTP, app passwords, SMS, auth, subscriptions, or production monitoring.
- Do not activate a production n8n schedule.
- Do not commit generated preview JSON/HTML files.
- Do not expose the local bridge beyond local development unless there is a deliberate temporary test reason.
- Do not treat a successful dry-run or local Mailpit capture as production notification readiness.
