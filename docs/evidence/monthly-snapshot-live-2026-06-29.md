
# Monthly Snapshot Live Run Evidence · 2026-06-29

## Summary

Shelter Signal monthly public-data snapshot workflow was executed through GitHub Actions with live generation mode enabled.

This evidence records that the workflow path can run beyond dry-run mode and reach both the snapshot generation step and the generated snapshot commit step.

## Workflow

* Repository: dffxonnb-cyber/shelter-signal
* Workflow: .github/workflows/monthly-notice-snapshot.yml
* Trigger: workflow_dispatch
* Branch: main
* Mode: dry_run=false
* Run result: Success
* Total duration: 34s

## What Was Verified

The live workflow run verified that:

* the Monthly Notice Snapshot workflow can be manually triggered
* the snapshot script syntax check passes in GitHub Actions
* the dry-run step is skipped when dry_run=false
* the workflow reaches Generate monthly snapshot
* the workflow reaches Commit generated snapshot
* the full GitHub Actions job completes successfully

## Verified Job Steps

* Set up job
* Checkout
* Setup Node
* Check snapshot script syntax
* Generate monthly snapshot
* Commit generated snapshot
* Post Setup Node
* Post Checkout
* Complete job

## Output Boundary

The successful workflow run proves that the live snapshot generation path completed in GitHub Actions.

The commit step may either:

* commit updated snapshot JSON files when generated data changed
* or complete without a new commit when generated output matches the existing snapshot files

Confirm the exact commit result through:

```powershell
git fetch origin
git log origin/main --oneline -5
```

## Claim Boundary

This evidence does not claim:

* real-time notice delivery
* complete upstream-data availability
* public API completeness
* shelter operation status
* adoption outcome tracking
* production SLA

This evidence only claims that the scheduled monthly snapshot workflow path can execute successfully in live generation mode.
