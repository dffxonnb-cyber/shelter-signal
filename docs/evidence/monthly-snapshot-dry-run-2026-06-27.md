# Monthly Snapshot Workflow Dry-run Evidence · 2026-06-27

## Summary

Shelter Signal now includes a manual GitHub Actions workflow for monthly public-data snapshot generation.

This evidence records a safe dry-run execution of the workflow before enabling real public API snapshot generation.

## Workflow

* Workflow: .github/workflows/monthly-notice-snapshot.yml
* Trigger: workflow_dispatch
* Branch: main
* Mode: dry_run=true
* Test month: 2026-06

## What Was Verified

The dry-run verified that:

* the GitHub Actions workflow can be manually triggered
* the snapshot script syntax check runs in CI
* the script can resolve the intended monthly snapshot period
* the script can resolve planned output paths
* the workflow can complete without DATA_GO_KR_SERVICE_KEY
* no public API request is made in dry-run mode
* no snapshot JSON files are written in dry-run mode

## Planned Output Paths

* app/public/data/latest-notices.json
* app/public/data/latest-notices.meta.json
* app/public/data/monthly-notices/2026-06.json
* app/public/data/monthly-notices/2026-06.meta.json

## Current Boundary

Actual snapshot generation is intentionally deferred until DATA_GO_KR_SERVICE_KEY is available as a GitHub Actions repository secret.

This dry-run does not prove:

* complete upstream-data freshness
* public API completeness
* real-time notice delivery
* shelter operation status
* adoption outcome tracking
* successful live public API collection

## Portfolio Interpretation

This evidence shows that the monthly snapshot workflow path is ready for controlled execution, while the actual data collection step remains secret-gated and claim-bounded.
