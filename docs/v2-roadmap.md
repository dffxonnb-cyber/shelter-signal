# Shelter Signal V2 Roadmap

## Current Baseline

Shelter Signal `main` currently uses the live-first Production architecture.

Completed V1 baseline:

- live public notice API as the primary `/api/notices` source
- KST rolling 30-day collection and freshness filtering
- current, urgent, protected, archive view separation
- server-side region filtering and page/limit pagination
- normalized live-data cache, in-flight request sharing, and safe diagnostics
- explicit live/cache/fallback/empty-state UI
- notice-derived `/api/shelters` contact context
- static/mock and optional PostgreSQL fallback

The older Neon operational DB primary path is archived in [neon-deployment.md](neon-deployment.md). It is not the current baseline.

## V2 Definition

V1 answers **what notices exist now**. V2 is the history-aware track that answers **what changed, what is approaching its deadline, and why a notice became a review candidate**.

V2 keeps the live-first `/api/notices` architecture intact and adds a separate preservation and decision layer.

```text
live public notice API
→ scheduled public-safe snapshot archive
→ observation history and change events
→ today-change summary and notice timeline
→ alert-candidate rules
→ daily digest JSON/HTML preview
→ optional local n8n or Mailpit validation
```

V2 is not a Production notification service and does not claim complete upstream history. It records what the collector observed, when it observed it, and where collection quality may be incomplete.

## Delivery Phases

### Phase 1 · Preservation baseline — completed

- daily scheduled public-safe snapshot collection
- manual dry-run and recovery execution
- generated-at, counts, truncation, and warning metadata
- latest fallback snapshot and monthly archive updates

### Phase 2 · Observation history — pipeline implemented

- stable public notice keys based on `desertion_no` with `notice_no` fallback
- comparison with the previous successful snapshot
- `NEW`, `DEADLINE_CHANGED`, `STATUS_CHANGED`, `BECAME_URGENT`, `NOT_OBSERVED`, `DISAPPEARED`, and `RETURNED` events
- two-date confirmation before promoting a missing record to `DISAPPEARED`
- same-day event merging so recovery runs do not erase earlier observations
- month-window reset protection against false mass disappearance
- schema and safety boundary: [Notice Change Event Schema](change-event-schema.md)

The remaining Phase 2 work is to run the pipeline against live snapshots and verify the generated event evidence over multiple collection dates.

### Phase 3 · V2 product surfaces

- today-change dashboard
- individual notice timeline
- collection-health panel
- evidence-backed deadline briefing

### Phase 4 · Digest dry-run

- `mart.alert_candidates` SQL view
- daily digest JSON/HTML preview
- local n8n HTTP Request testing
- local Mailpit rendering checks
- generated preview verification

## Allowed Scope

- scheduled snapshot collection and public-safe archive commits
- observation and change-event modeling
- today-change summaries and notice timelines
- collection-quality metadata and warnings
- `mart.alert_candidates` SQL view
- daily digest preview export
- local dry-run scripts
- local n8n and Mailpit validation

## Out Of Scope

- real external email, SMS, or push delivery
- SMTP/Gmail credentials or OAuth
- real recipients and subscription management
- authentication
- activated Production notification schedules
- Production notification monitoring or delivery SLA
- changing the live-first `/api/notices` architecture
- claiming that a missing notice proves adoption, transfer, euthanasia, or another final outcome

A scheduled data-preservation workflow is allowed. A scheduled external notification-delivery workflow remains out of scope.

## Local Revalidation

```powershell
npm run snapshot:check
npm run snapshot:test
npm run snapshot:dry-run
python scripts/validate_pipeline.py
python scripts/run_daily_digest_dry_run.py
cd app
npm run lint
npm run typecheck
npm run build
```

Generated preview files under `data/exports/` must remain uncommitted.

## Safety Boundaries

- Do not commit or log database URLs, service keys, SMTP credentials, tokens, or real recipients.
- Do not present local Mailpit or n8n dry-run as Production notification readiness.
- Keep the current live-first notice pipeline unchanged while adding the V2 history layer.
- Preserve collection warnings such as truncation instead of presenting snapshots as complete upstream truth.
- Describe `DISAPPEARED` as an observation state until repeated collection or a source state confirms otherwise.

## Future Candidates

These items require a separate decision and are not needed for the current portfolio baseline:

- consented saved-notice and subscription design
- shared cache only if cross-instance consistency becomes necessary
- Production monitoring only if the project becomes an operated service
- external notification provider evaluation
