# n8n Local Dry-Run Setup

This guide connects Shelter Signal V2's existing daily digest dry-run command to a local n8n workflow. It is a generation-only stage: n8n runs the local preview command, verifies that preview files are created, and stops before any real email sending.

This setup does not add Gmail, SMTP, SMS, auth, user accounts, real recipients, or API keys.

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

## Preferred Local Setup

From the repository root on branch `v2/n8n-email-alerts`:

```powershell
docker compose up -d postgres
python scripts/validate_pipeline.py
python scripts/run_daily_digest_dry_run.py
```

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

If n8n is started from another directory, update the Execute Command node to change into the repository root first. On Windows, use a command like this with your local repository path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location '<repo-root>'; python scripts/run_daily_digest_dry_run.py"
```

Do not put secrets, recipients, or credentials in the workflow JSON.

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

If n8n itself runs inside a Docker container, the container would also need access to the repository, Python, Docker Compose, and usually the host Docker socket. That is not a safe minimal default for this repository.

Known local caveats:

- Docker Desktop must be running before the dry-run command can query PostgreSQL.
- Windows command quoting differs between PowerShell and `cmd.exe`; start with the simple relative command by launching n8n from the repository root.
- If `python` opens the Microsoft Store launcher, use `py -3` or the full path to your Python executable in the Execute Command node.
- Bind mounts from OneDrive paths or non-ASCII paths can be fragile in Docker Desktop. Running n8n as a host process avoids most of that path mapping trouble.
- A future Docker-based n8n setup should use a deliberate custom image or controlled runner design rather than mounting Docker access into a generic n8n container by default.

This is a local dry-run integration only, not a production-ready automation or notification system.
