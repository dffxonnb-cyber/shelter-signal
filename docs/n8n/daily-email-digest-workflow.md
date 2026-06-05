# Daily Digest Preview Workflow

## Purpose

Shelter Signal V2 validates a digest preview path for time-sensitive rescued-animal notices. The workflow reads `mart.alert_candidates`, generates JSON/HTML preview output, and optionally lets local n8n trigger the dry-run through an HTTP bridge.

This is not a production notification workflow. It does not send real email, SMS, push notifications, or subscriber alerts.

## Relationship To V1.5

V1.5 is the deployed portfolio baseline:

```text
Docker local PostgreSQL validation
-> Neon hosted PostgreSQL
-> Vercel /api/notices
-> React PWA
-> static JSON fallback
-> mock fallback
```

The V2 digest preview path is separate:

```text
Docker PostgreSQL
-> mart.alert_candidates
-> daily digest dry-run
-> preview JSON/HTML
-> optional local n8n HTTP Request
```

n8n does not replace the deployed `/api/notices` read path and does not write data to Neon in this branch.

## Candidate Source

The digest preview is based on:

```text
sql/models/006_alert_candidates.sql
```

That model creates `mart.alert_candidates` from `mart.animals_clean`. It prioritizes urgent or soon-ending notices, then fills the preview list with the highest-scored remaining notices when needed.

## Primary Dry-Run Command

Run this from the repository root:

```powershell
python scripts/run_daily_digest_dry_run.py
```

The command verifies:

- local PostgreSQL connection
- `mart.alert_candidates` availability
- candidate count
- JSON preview export
- HTML preview export
- no email sent

Preview outputs:

```text
data/exports/email_digest_preview.json
data/exports/email_digest_preview.html
```

Generated preview files must stay uncommitted.

## Optional n8n HTTP Bridge

Start the local bridge:

```powershell
python scripts/serve_daily_digest_dry_run.py
```

Recommended n8n HTTP Request node:

```text
Method: POST
URL: http://host.docker.internal:8787/dry-run
Authentication: None
Send Query Parameters: Off
Send Headers: Off
Send Body: Off
```

If n8n runs directly on the host, this URL may also work:

```text
http://127.0.0.1:8787/dry-run
```

For local HTML payload inspection only:

```text
http://host.docker.internal:8787/dry-run?include_html=true
```

The HTML payload is for preview inspection and optional local rendering tests. It is not a send step.

## Workflow Drafts

- `docs/n8n/daily-digest-http-dry-run.workflow.json`: recommended local HTTP Request draft
- `docs/n8n/daily-digest-dry-run.workflow.json`: optional legacy Execute Command draft
- `docs/n8n/manual-test-email.workflow.json`: optional local Mailpit outline only

The committed workflow drafts should remain inactive and credential-free.

## Safety Boundaries

Do not add or commit:

- Gmail OAuth credentials
- Google Cloud OAuth client secrets
- Gmail SMTP app passwords
- external SMTP credentials
- real recipient addresses
- service keys
- `DATABASE_URL`
- activated production schedules

Out of scope for this branch:

- real email delivery
- SMS or push delivery
- auth
- subscriptions
- unsubscribe handling
- production monitoring
- actual public-data ingestion into hosted Neon

The next V2+ product work should first decide how real public-data rows are loaded into the hosted DB. Real notification delivery should come later, after consent, unsubscribe, credential handling, bounce handling, rate limits, and monitoring are designed.
