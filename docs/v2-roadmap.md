# Shelter Signal V2 Roadmap

## Product Definition

V1 answers **what notices exist now**.

V2 answers **what changed, what is approaching its deadline, and why a notice should be reviewed first**.

V2 keeps the live-first `/api/notices` architecture intact and adds a separate preservation, observation, and decision layer.

```text
live public notice API
→ scheduled public-safe snapshot archive
→ observation history and change events
→ today-change dashboard
→ per-notice cumulative timeline
→ evidence-backed deadline briefing
```

V2 is not a Production notification service and does not claim complete upstream history. It records what the collector observed, when it observed it, and where collection quality may be incomplete.

## Delivery Status

### Phase 1 · Preservation baseline — completed

- daily scheduled public-safe collection at 06:20 KST
- manual dry-run and recovery execution
- latest and monthly snapshot updates
- generated-at, counts, truncation, and warning metadata
- GitHub Actions bot commit path verified with live public API collection

### Phase 2 · Observation history — implemented

- stable public notice keys based on `desertion_no` with `notice_no` fallback
- comparison with the previous successful snapshot
- `NEW`, `DEADLINE_CHANGED`, `STATUS_CHANGED`, `BECAME_URGENT`, `NOT_OBSERVED`, `DISAPPEARED`, and `RETURNED`
- two-date confirmation before promoting a missing record to `DISAPPEARED`
- same-day event merging so recovery runs do not erase earlier observations
- month-window reset protection against false mass disappearance
- per-notice cumulative timeline with `eventId` deduplication
- schema and safety boundary: [Notice Change Event Schema](change-event-schema.md)

Live bootstrap evidence on 2026-07-14:

- 2,172 normalized notices
- 19 daily change events
- 19 notice timelines
- no collection truncation or warning in the verified run

The remaining operational check is multi-date scheduled observation. The next automatic run should create a new daily event date and preserve timeline continuity without manual execution.

### Phase 3 · V2 product surfaces — completed

- today-change dashboard
- collection-health panel
- change-type filtering
- individual notice timeline
- evidence-backed D-Day~D-3 deadline briefing
- region and deadline filters
- explanatory inclusion reasons
- V1/V2 and V2 section navigation

### Phase 4 · Digest dry-run — archived optional experiment

The repository retains the earlier local alert-candidate and digest experiment:

- `mart.alert_candidates` SQL view
- daily digest JSON/HTML preview
- local n8n HTTP Request testing
- local Mailpit rendering checks

This phase is not required for the current V2 product baseline and does not represent Production notification delivery.

## Completed Product Baseline

```text
V1
current notice exploration
+ live/cache/fallback boundaries
+ region/view/page filtering

V2
scheduled preservation
+ change detection
+ missing-state caution
+ today-change summary
+ notice timeline
+ deadline briefing
```

## Allowed Scope

- scheduled snapshot collection and public-safe archive commits
- observation and change-event modeling
- today-change summaries and notice timelines
- collection-quality metadata and warnings
- evidence-backed deadline briefing
- local-only alert candidate and digest dry-run

## Out Of Scope

- real external email, SMS, or push delivery
- SMTP/Gmail credentials or OAuth
- real recipients and subscription management
- authentication
- activated Production notification schedules
- Production notification monitoring or delivery SLA
- changing the live-first `/api/notices` architecture
- claiming that a missing notice proves adoption, transfer, euthanasia, or another final outcome
- predictive risk or adoption models without validated outcome labels

A scheduled data-preservation workflow is part of V2. Scheduled external notification delivery is not.

## Final Verification Checklist

Repository checks:

```powershell
npm run snapshot:check
npm run snapshot:test
npm run snapshot:dry-run
cd app
npm run lint
npm run typecheck
npm run build
```

Production checks:

- `#live`: Live API, region, pagination, fallback boundary
- `#changes`: event summary, collection health, event filters
- `#briefing`: D-Day~D-3 summary, priority reasons, region filter
- timeline: direct hash navigation and cumulative events
- GitHub Actions: next scheduled run succeeds without manual trigger
- generated files: new daily event date and cumulative timeline remain public-safe

## Safety Boundaries

- Do not commit or log database URLs, service keys, SMTP credentials, tokens, or real recipients.
- Keep the current live-first notice pipeline unchanged while adding the history layer.
- Preserve collection warnings such as truncation instead of presenting snapshots as complete upstream truth.
- Describe `DISAPPEARED` as an observation state, not a confirmed animal outcome.
- Describe deadline ranking as an explainable review order, not an official danger score or prediction.
- State that the cumulative history begins when V2 event preservation started on 2026-07-14.

## Future Candidates

These require a separate product decision and are not needed for completion:

- consented saved-notice and subscription design
- shared cache only if cross-instance consistency becomes necessary
- Production monitoring only if the project becomes an operated service
- external notification provider evaluation
