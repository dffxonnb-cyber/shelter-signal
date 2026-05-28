# n8n Local Dry-Run Setup

This guide connects Shelter Signal V2's existing daily digest dry-run command to a local n8n workflow. It is a generation-only stage: n8n runs the local preview command, verifies that preview files are created, and stops before any real email sending.

This setup does not add Gmail, external SMTP, SMS, auth, user accounts, real recipients, or API keys. Manual email rendering can be tested locally with Mailpit, which captures messages instead of sending real external email.

## Recommended Final Check

For finalized V2 local testing, run the Mailpit smoke test before configuring any n8n Send an Email credentials:

```powershell
python scripts/run_v2_mailpit_email_capture_test.py
```

Expected PASS includes:

- dry-run PASS
- HTML export PASS
- SMTP send PASS
- Mailpit inbox verification PASS

This is the recommended completion check because it verifies local SMTP send, inbox capture, and HTML rendering without Gmail, Google Cloud, OAuth, app passwords, real recipients, or external delivery.

## Local Prerequisites

Use this setup from the `v2/n8n-email-alerts` branch.

Local requirements:

- Docker Desktop running
- Docker Compose available as `docker compose`
- PostgreSQL started from this repository's `docker-compose.yml`
- Python available as `python` or, on Windows, `py -3`
- n8n running locally, preferably as a host process from the repository root
- no Gmail, external SMTP credentials, real recipients, or API keys in the workflow
- optional Mailpit local SMTP capture for manual rendering checks

The current Compose file starts PostgreSQL and Mailpit only. It intentionally does not start n8n, because this dry-run command needs access to the repository files, local Python, Docker Compose, and the running Postgres service.

## What This Stage Proves

The local n8n dry-run verifies that n8n can call the existing repository script, either through the recommended local HTTP bridge or through an optional Execute Command node:

```powershell
python scripts/run_daily_digest_dry_run.py
```

That script checks local PostgreSQL availability, confirms `mart.alert_candidates` exists, exports the digest preview files, and verifies both files were written.

Generated files:

```text
data/exports/email_digest_preview.json
data/exports/email_digest_preview.html
```

These preview files can contain live-like local data, so `data/exports/*.json` and `data/exports/*.html` remain ignored by Git.

## PostgreSQL And Port Handling

Start PostgreSQL with Docker Compose:

```powershell
docker compose up -d postgres
docker compose ps
```

By default, the repository maps the Postgres container to host port `5432`:

```yaml
ports:
  - "${POSTGRES_PORT:-5432}:5432"
```

If local port `5432` is already occupied, use `5433` for the host binding before starting the service.

PowerShell session-only option:

```powershell
$env:POSTGRES_PORT = "5433"
docker compose up -d postgres
```

`.env` option:

```text
POSTGRES_PORT=5433
```

The Postgres service still listens on `5432` inside Docker. The `POSTGRES_PORT=5433` fallback only changes the host port binding so Docker Desktop can start the container without conflicting with another local Postgres install.

After Postgres is up, run the existing validation once:

```powershell
python scripts/validate_pipeline.py
```

## Why The Local Runner Needs Repository Access

The process that actually runs the dry-run command must be able to see the repository. In the recommended HTTP Request 방식, that process is `scripts/serve_daily_digest_dry_run.py`. In the optional Execute Command 방식, it is the n8n process itself.

For this dry-run, the runner environment must be able to see:

- `scripts/run_daily_digest_dry_run.py`
- `scripts/export_email_digest.py`
- `docker-compose.yml`
- local Python
- Docker Compose and the running PostgreSQL service
- `data/exports/` so the preview JSON/HTML can be written

The simplest local setup is to start the bridge from the repository root. Then the bridge can use the same relative paths that developers already use:

```powershell
python scripts/run_daily_digest_dry_run.py
```

## Run The Dry-Run Manually

From the repository root on branch `v2/n8n-email-alerts`:

```powershell
docker compose up -d postgres
python scripts/validate_pipeline.py
python scripts/run_daily_digest_dry_run.py
```

The final command is the same command n8n should run during this stage.

Expected generated files:

```text
data/exports/email_digest_preview.json
data/exports/email_digest_preview.html
```

No email is sent by this script.

## HTTP Request 방식

Some local n8n setups do not expose a usable Execute Command node. In that case, importable workflows may show the command node as an unknown/question-mark node. The local HTTP bridge exists so n8n can use a standard HTTP Request node instead.

Start the bridge from the repository root:

```powershell
python scripts/serve_daily_digest_dry_run.py
```

By default, it listens only on local loopback:

```text
http://127.0.0.1:8787
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Run the dry-run through HTTP:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8787/dry-run
```

In n8n, use an HTTP Request node:

```text
Method: POST
URL: http://127.0.0.1:8787/dry-run
Authentication: none
Body: none
```

## 검증된 n8n HTTP Request 설정

The working local n8n configuration used this HTTP Request node setup:

```text
Method: POST
URL: http://host.docker.internal:8787/dry-run
Authentication: None
Send Query Parameters: Off
Send Headers: Off
Send Body: Off
```

`127.0.0.1` and `localhost` may fail depending on how n8n is running. If n8n runs in Docker, `127.0.0.1` points to the n8n container itself, not the host process running `scripts/serve_daily_digest_dry_run.py`. In the confirmed local setup, `host.docker.internal` reached the host machine and successfully called the bridge.

Confirmed n8n result:

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

This confirms generation only. It does not enable email sending, credentials, recipients, SMS, auth, or a production backend.

Import the HTTP workflow draft:

```text
docs/n8n/daily-digest-http-dry-run.workflow.json
```

Expected successful response:

```json
{
  "status": "ok",
  "dry_run_result": {
    "result": "PASS",
    "db_connection_status": "PASS",
    "alert_candidates_status": "PASS",
    "preview_rows_exported": 12,
    "json_export_status": "PASS data/exports/email_digest_preview.json",
    "html_export_status": "PASS data/exports/email_digest_preview.html"
  },
  "alert_candidate_count": 12,
  "json_export_path": "data/exports/email_digest_preview.json",
  "html_export_path": "data/exports/email_digest_preview.html",
  "message": "PASS daily digest preview dry-run complete. No email was sent."
}
```

On failure, the response uses `status: "error"` and returns a non-200 HTTP status with a message explaining the failed local step. Check the bridge terminal logs and n8n execution output.

Keep the bridge running while n8n executes the workflow. Stop it with `Ctrl+C` when the local test is done.

## n8n Email Send 준비용 HTML payload

The dry-run bridge can optionally include the generated email HTML body in the response. This is for a later manual Email Send node test, where n8n needs the HTML body content without reading the local file directly.

Default `/dry-run` responses stay compact and do not include `email_html`.

To include the generated HTML:

```text
Method: POST
URL: http://host.docker.internal:8787/dry-run?include_html=true
Authentication: None
Send Query Parameters: Off
Send Headers: Off
Send Body: Off
```

Equivalent JSON body option:

```json
{
  "include_html": true
}
```

When enabled, the bridge runs the same dry-run, reads `data/exports/email_digest_preview.html` after the preview is generated, and adds `email_html` to the JSON response:

```json
{
  "status": "ok",
  "dry_run_result": {
    "result": "PASS"
  },
  "alert_candidate_count": 5,
  "json_export_path": "data/exports/email_digest_preview.json",
  "html_export_path": "data/exports/email_digest_preview.html",
  "email_html": "<!doctype html>...",
  "message": "PASS daily digest preview dry-run complete. No email was sent."
}
```

This still does not send email by itself. It does not add credentials, recipients, Gmail or external SMTP settings, SMS, auth, or production backend behavior. If the generated HTML file is missing or empty, the bridge returns `status: "error"` with a non-200 response.

## 로컬 메일 캡처로 테스트 이메일 확인하기

Use Mailpit for the V2-3 manual email rendering test. This avoids Gmail OAuth, Google Cloud OAuth Client setup, Gmail SMTP app passwords, and real external email delivery.

Mailpit is a local email capture inbox:

```text
SMTP: localhost:1025
Web inbox: http://localhost:8025
```

n8n sends the test message to Mailpit SMTP, and Mailpit shows the captured message in the browser. It does not send the email to the public internet.

Start the local services and dry-run bridge from PowerShell:

```powershell
cd C:\Users\msi\OneDrive\문서\GitHub\shelter-signal
git checkout v2/n8n-email-alerts
git pull
$env:POSTGRES_PORT="5433"
docker compose up -d
python scripts/serve_daily_digest_dry_run.py
```

Open the Mailpit inbox:

```text
http://localhost:8025
```

Then open n8n:

```text
http://localhost:5678
```

Use the manual workflow:

```text
Manual Trigger
→ HTTP Request
→ Send an Email
→ Mailpit inbox
```

HTTP Request node:

```text
Method: POST
URL: http://host.docker.internal:8787/dry-run?include_html=true
Authentication: None
Send Query Parameters: Off
Send Headers: Off
Send Body: Off
```

Send an Email node SMTP settings:

```text
Credential type: SMTP
Host: host.docker.internal
Port: 1025
Secure: false
User: leave empty if allowed
Password: leave empty if allowed
From Email: shelter-signal@test.local
To Email: test-recipient@example.local
Subject: [TEST] Shelter Signal Daily Digest
Email Format: HTML
HTML: {{$json.email_html}}
```

If n8n requires a username/password in the SMTP credential form, use harmless local placeholders:

```text
User: test
Password: test
```

Mailpit does not authenticate by default in this local capture setup. Do not use Gmail OAuth, Google Cloud credentials, Gmail SMTP, real recipients, or production credentials.

## 원커맨드 Mailpit 이메일 캡처 검증

Before configuring any n8n Send an Email credentials, run the local Mailpit smoke test script. This is the recommended verification path because it does not require n8n credentials and does not send real external email.

The script:

- runs the existing V2 daily digest dry-run
- verifies `data/exports/email_digest_preview.html`
- sends the HTML preview to Mailpit SMTP at `localhost:1025`
- polls Mailpit at `http://localhost:8025/api/v1/messages`
- verifies the captured subject, sender, recipient, and HTML body

Command:

```powershell
python scripts/run_v2_mailpit_email_capture_test.py
```

Expected PASS includes:

- dry-run PASS
- HTML export PASS
- SMTP send PASS
- Mailpit inbox verification PASS

If Mailpit is not reachable, start the local services first:

```powershell
cd C:\Users\msi\OneDrive\문서\GitHub\shelter-signal
git checkout v2/n8n-email-alerts
git pull
$env:POSTGRES_PORT="5433"
docker compose up -d
```

If the script reports missing database prerequisites, run:

```powershell
python scripts/validate_pipeline.py
python scripts/run_v2_mailpit_email_capture_test.py
```

After the script passes, open Mailpit to inspect the rendered test message:

```text
http://localhost:8025
```

## Manual Test Email Send 준비 절차

This is the V2-3 manual local test path. It prepares one human-triggered email send from n8n only after the bridge returns `email_html`. Use Mailpit for local capture so no real external email is sent. It does not add schedules, real credentials, real recipients, SMS, auth, user accounts, or production subscription behavior to the repository.

Step 1. Start the local dry-run bridge.

Open PowerShell and run:

```powershell
cd C:\Users\msi\OneDrive\문서\GitHub\shelter-signal
git checkout v2/n8n-email-alerts
git pull
$env:POSTGRES_PORT="5433"
docker compose up -d
python scripts/serve_daily_digest_dry_run.py
```

Leave this terminal open while n8n runs. The bridge should expose:

```text
GET  http://127.0.0.1:8787/health
POST http://127.0.0.1:8787/dry-run
```

Mailpit should expose:

```text
SMTP: localhost:1025
Inbox: http://localhost:8025
```

Step 2. Open Mailpit and n8n:

```text
http://localhost:8025
```

```text
http://localhost:5678
```

Step 3. Create or open the manual test workflow.

You can build it manually or import the outline:

```text
docs/n8n/manual-test-email.workflow.json
```

Step 4. Set the HTTP Request node URL to:

```text
http://host.docker.internal:8787/dry-run?include_html=true
```

Use these HTTP Request settings:

```text
Method: POST
Authentication: None
Send Query Parameters: Off
Send Headers: Off
Send Body: Off
```

Step 5. Run the HTTP Request node and confirm `email_html` exists.

The expected response shape includes:

```json
{
  "status": "ok",
  "dry_run_result": {
    "result": "PASS"
  },
  "alert_candidate_count": 5,
  "email_html": "<!doctype html>...",
  "message": "PASS daily digest preview dry-run complete. No email was sent."
}
```

Do not continue to the Email Send node if `status` is not `ok`, `dry_run_result.result` is not `PASS`, or `email_html` is missing/empty.

Step 6. Add an Email Send node only after `email_html` is visible.

Safety settings:

- Use only one local test recipient.
- Use `test-recipient@example.local` for Mailpit capture.
- Use placeholder addresses in any exported workflow JSON.
- Subject must start with `[TEST] Shelter Signal Daily Digest`.
- Enable Send as HTML / HTML email mode.
- Use Mailpit SMTP on `host.docker.internal:1025`.
- Do not add a Schedule Trigger.
- Do not publish or activate the workflow yet.
- Do not use Gmail OAuth, Google Cloud credentials, Gmail SMTP, or app passwords.

Step 7. Use this expression for the HTML body:

```text
{{$json.email_html}}
```

If the Email Send node needs to reference the HTTP Request node directly, use:

```text
{{$node["HTTP Request"].json["email_html"]}}
```

Step 8. Send only one manual test email to Mailpit.

After the test, confirm the captured message appears at `http://localhost:8025`. Leave the workflow inactive and keep any local n8n credential placeholders out of Git. Do not commit generated preview files, credentials, or real recipient addresses.

## Execute Command 방식 (optional/legacy)

Use this only when your n8n setup exposes a working Execute Command node. If n8n shows the command node as unknown or unavailable, use the HTTP Request 방식 above.

Then start n8n locally from the same repository root:

```powershell
npx n8n@latest start
```

Open n8n at:

```text
http://localhost:5678
```

Import the draft workflow:

```text
docs/n8n/daily-digest-dry-run.workflow.json
```

Run it with the Manual Trigger. The Execute Command node should run:

```powershell
python scripts/run_daily_digest_dry_run.py
```

If `python` is not available but the Windows Python launcher is, change the node command to:

```powershell
py -3 scripts/run_daily_digest_dry_run.py
```

If n8n is started from another directory, update the Execute Command node to change into the repository root first. On Windows, use a command like this with your local repository path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location '<repo-root>'; python scripts/run_daily_digest_dry_run.py"
```

Do not put secrets, recipients, or credentials in the workflow JSON.

## If n8n Runs In Docker

Running n8n in Docker is possible later, but it is not the recommended dry-run path for this branch.

For the existing command to work from inside an n8n container, the container would need:

- the project directory mounted into the container
- a working directory that matches the mounted project path
- Python installed inside the n8n runtime or a custom n8n image
- access to Docker Compose and the running `postgres` service
- write access to `data/exports/`

Because `scripts/run_daily_digest_dry_run.py` shells out to Docker Compose to query PostgreSQL, a containerized n8n runner may also need access to the host Docker daemon. Mounting Docker access into a generic automation container is not a safe minimal default, so this repository does not add an n8n service to `docker-compose.yml` yet.

For now, use host n8n plus the local HTTP bridge for the most practical dry-run setup, and keep Docker Compose focused on PostgreSQL plus Mailpit local capture.

## Workflow Draft Behavior

The recommended local fallback workflow draft uses:

- Manual Trigger for development runs
- HTTP Request node for `POST http://127.0.0.1:8787/dry-run`
- sticky notes for response inspection and safety expectations
- no credentials and no recipients
- no Email Send node

The optional/legacy Execute Command workflow draft uses:

- Manual Trigger for development runs
- disabled Schedule Trigger note for a later stage
- Execute Command node for `python scripts/run_daily_digest_dry_run.py`
- sticky notes for success and failure expectations
- disabled Email Send placeholder with no credentials and no recipients

The manual Mailpit test outline uses:

- Manual Trigger for local runs
- HTTP Request node for `POST http://host.docker.internal:8787/dry-run?include_html=true`
- disabled Email Send placeholder with Mailpit SMTP notes
- placeholder sender and recipient values only
- no Gmail, Google Cloud, app password, real recipient, or production credential setup

The dry-run workflows do not send email. The manual Mailpit outline is designed for one local capture test only, and the Email Send placeholder stays disabled until a human configures local Mailpit SMTP inside n8n.

## Why No Real Email Is Sent

External email sending is intentionally out of scope for this stage.

- `scripts/run_daily_digest_dry_run.py` never sends email.
- `scripts/serve_daily_digest_dry_run.py` only exposes the dry-run over local HTTP.
- The dry-run workflow command only generates local preview files.
- Mailpit captures local SMTP messages instead of delivering them externally.
- The workflow contains no Gmail, Google Cloud, OAuth, app password, or production SMTP credentials.
- The workflow contains no real recipients.
- The Email Send node is disabled in the committed workflow outline.

Actual external email sending comes later, after preview quality, safety language, credential handling, recipient consent, unsubscribe behavior, bounce handling, and rate limits are designed.

## Windows And Docker Limitations

The current `docker-compose.yml` is left focused on PostgreSQL plus Mailpit local email capture. Adding an n8n Docker service now would be misleading because the dry-run script calls Docker Compose from the repository root:

```text
python script -> docker compose exec postgres -> psql
```

Known local caveats:

- Docker Desktop must be running before the dry-run command can query PostgreSQL.
- If host port `5432` is busy, set `POSTGRES_PORT=5433` before starting the Postgres service.
- Mailpit uses host ports `1025` for SMTP and `8025` for the web inbox.
- Windows command quoting differs between PowerShell and `cmd.exe`; start with the simple relative command by launching n8n from the repository root.
- If `python` opens the Microsoft Store launcher, use `py -3` or the full path to your Python executable in the Execute Command node.
- If n8n runs in Docker, `127.0.0.1` points at the n8n container rather than the host. Prefer host n8n for this dry-run bridge. Do not broaden the bridge binding beyond local development unless you have a deliberate, temporary networking reason.
- Bind mounts from OneDrive paths or non-ASCII paths can be fragile in Docker Desktop. Running n8n as a host process avoids most of that path mapping trouble.
- A future Docker-based n8n setup should use a deliberate custom image or controlled runner design rather than mounting Docker access into a generic n8n container by default.

## Safety Notes

- This stage verifies local preview generation and optional Mailpit rendering only.
- Do not enable the Email Send placeholder unless you are doing the one-message local Mailpit capture test.
- Do not add Gmail, external SMTP, OAuth, API keys, or real recipients.
- Do not add SMS, auth, user accounts, or subscription behavior.
- Do not commit generated preview JSON/HTML files.
- Do not treat a successful dry-run or Mailpit capture as production readiness.

This is a local dry-run integration only, not a production-ready automation or notification system.
