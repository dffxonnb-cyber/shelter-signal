# n8n Snapshot Automation

## Purpose

Shelter Signal uses a GitHub Actions workflow to generate monthly public-data snapshots.

n8n is used as an external automation trigger.
It does not own the public-data parsing logic.

## Responsibility Split

| Area                    | Owner                             |
| ----------------------- | --------------------------------- |
| Schedule trigger        | n8n                               |
| Manual/remote execution | GitHub Actions workflow_dispatch  |
| Public data fetching    | scripts/fetch-monthly-notices.mjs |
| Normalization           | scripts/fetch-monthly-notices.mjs |
| Snapshot commit         | GitHub Actions                    |
| Public JSON output      | app/public/data                   |

## Target Workflow

```text
n8n Cron
→ GitHub API workflow_dispatch
→ Monthly Notice Snapshot
→ npm run snapshot:check
→ npm run snapshot:monthly
→ Commit generated snapshot JSON
```

## GitHub Actions Workflow

File:

```text
.github/workflows/monthly-notice-snapshot.yml
```

Workflow name:

```text
Monthly Notice Snapshot
```

Required secret:

```text
DATA_GO_KR_SERVICE_KEY
```

## n8n HTTP Request

Method:

```text
POST
```

URL:

```text
https://api.github.com/repos/dffxonnb-cyber/shelter-signal/actions/workflows/monthly-notice-snapshot.yml/dispatches
```

Headers:

```text
Authorization: Bearer {{GITHUB_TOKEN}}
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json
```

Body:

```json
{
  "ref": "main",
  "inputs": {
    "month": "",
    "dry_run": "false"
  }
}
```

## Dry Run Body

```json
{
  "ref": "main",
  "inputs": {
    "month": "",
    "dry_run": "true"
  }
}
```

## Recommended n8n Flow

```text
Cron
→ HTTP Request: Dispatch GitHub Actions workflow
→ Wait
→ HTTP Request: Check workflow run status
→ IF success/failure
```

## Verification Checklist

* [ ] GitHub secret `DATA_GO_KR_SERVICE_KEY` exists.
* [ ] n8n credential stores `GITHUB_TOKEN`.
* [ ] n8n dispatch request returns 204.
* [ ] GitHub Actions run starts.
* [ ] Snapshot files are updated only when `dry_run` is `"false"`.
* [ ] `latest-notices.json` is updated.
* [ ] `latest-notices.meta.json` is updated.
* [ ] Monthly snapshot JSON is committed.
* [ ] Monthly snapshot meta JSON is committed.

## Claim Boundary

This automation is a scheduled public-data snapshot workflow.

It is not a real-time shelter operation system.
It does not guarantee complete upstream data availability.
It does not track adoption outcomes.
