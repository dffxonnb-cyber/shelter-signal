# n8n Local Dry-Run Setup

This guide connects Shelter Signal V2's existing daily digest dry-run command to a local n8n workflow. It is a generation-only stage: n8n runs the local preview command, verifies that preview files are created, and stops before any real email sending.

This setup does not add Gmail, SMTP, SMS, auth, user accounts, real recipients, or API keys.

## Local Prerequisites

Use this setup from the `v2/n8n-email-alerts` branch.

Local requirements:

- Docker Desktop running
- Docker Compose available as `docker compose`
- PostgreSQL started from this repository's `docker-compose.yml`
- Python available as `python` or, on Windows, `py -3`
- n8n running locally, preferably as a host process from the repository root
- no email credentials, recipients, SMTP settings, or API keys in the workflow

The current Compose file only starts PostgreSQL. It intentionally does not start n8n, because this dry-run command needs access to the repository files, local Python, Docker Compose, and the running Postgres service.

## What This Stage Proves

The local n8n dry-run verifies that n8n can call the existing repository script:

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

## Why n8n Needs Repository Access

n8n's Execute Command node runs on the same machine or container where n8n itself is running. For this dry-run, that environment must be able to see:

- `scripts/run_daily_digest_dry_run.py`
- `scripts/export_email_digest.py`
- `docker-compose.yml`
- local Python
- Docker Compose and the running PostgreSQL service
- `data/exports/` so the preview JSON/HTML can be written

The simplest local setup is to start n8n from the repository root. Then the workflow command can use the same relative path that developers already use:

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

## Run n8n On The Host

The recommended local path is to run n8n directly on the host machine from the repository root.

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

For now, use host n8n for the dry-run execution setup and keep Docker Compose focused on PostgreSQL.

## Workflow Draft Behavior

The local workflow draft uses:

- Manual Trigger for development runs
- disabled Schedule Trigger note for a later stage
- Execute Command node for `python scripts/run_daily_digest_dry_run.py`
- sticky notes for success and failure expectations
- disabled Email Send placeholder with no credentials and no recipients

The workflow does not send email. The disabled Email Send node exists only to show where a later, separately approved sending stage might be designed.

## Why No Email Is Sent

Email sending is intentionally out of scope for this stage.

- `scripts/run_daily_digest_dry_run.py` never sends email.
- The workflow command only generates local preview files.
- The workflow contains no Gmail, SMTP, OAuth, or API credentials.
- The workflow contains no real recipients.
- The Email Send node is disabled and should remain disconnected during this stage.

Actual email sending comes later, after preview quality, safety language, credential handling, recipient consent, unsubscribe behavior, bounce handling, and rate limits are designed.

## Windows And Docker Limitations

The current `docker-compose.yml` is left focused on PostgreSQL. Adding an n8n Docker service now would be misleading because the dry-run script calls Docker Compose from the repository root:

```text
python script -> docker compose exec postgres -> psql
```

Known local caveats:

- Docker Desktop must be running before the dry-run command can query PostgreSQL.
- If host port `5432` is busy, set `POSTGRES_PORT=5433` before starting the Postgres service.
- Windows command quoting differs between PowerShell and `cmd.exe`; start with the simple relative command by launching n8n from the repository root.
- If `python` opens the Microsoft Store launcher, use `py -3` or the full path to your Python executable in the Execute Command node.
- Bind mounts from OneDrive paths or non-ASCII paths can be fragile in Docker Desktop. Running n8n as a host process avoids most of that path mapping trouble.
- A future Docker-based n8n setup should use a deliberate custom image or controlled runner design rather than mounting Docker access into a generic n8n container by default.

## Safety Notes

- This stage only verifies local preview generation.
- Do not enable the Email Send placeholder.
- Do not add Gmail, SMTP, OAuth, API keys, or real recipients.
- Do not add SMS, auth, user accounts, or subscription behavior.
- Do not commit generated preview JSON/HTML files.
- Do not treat a successful dry-run as production readiness.

This is a local dry-run integration only, not a production-ready automation or notification system.
