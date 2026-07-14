# Shelter Signal Verification Guide

## Verification Boundary

Repository verification, scheduled data preservation, and Production smoke testing have different purposes.

- CI/local verification checks tracked code without Production secrets or external API calls.
- Notice Snapshot Archive verifies the real public-data collection and generated-file path.
- Production smoke testing checks the deployed V1 and V2 product surfaces.
- None of these steps proves complete upstream history, perfect field accuracy, or a final outcome for a missing notice.

Current public-safe evidence:

- [2026-07-14 V2 Production verification](docs/evidence/v2-production-verification-2026-07-14.md)
- [Evidence index](docs/evidence/README.md)

## Secret-free Repository Verification

Run from the repository root:

```powershell
npm run snapshot:check
npm run snapshot:test
npm run snapshot:dry-run
cd app
npm ci
npm run lint
npm run typecheck
npm run build
```

These commands do not require:

- `DATA_GO_KR_SERVICE_KEY`
- `DATABASE_URL`
- `NOTICES_CACHE_TTL_SECONDS`
- external public API access

Verified repository scope:

- snapshot and change-event script syntax
- all seven event rules
- missing → disappeared → returned transitions
- month-window reset protection
- per-notice timeline accumulation and `eventId` deduplication
- same-day daily-event bootstrap
- frontend lint, TypeScript, and production build

## GitHub Actions Verify

`.github/workflows/verify.yml` runs on pull requests and pushes to `main`.

Snapshot job:

```text
npm run snapshot:check
npm run snapshot:test
npm run snapshot:dry-run
```

App job:

```text
cd app
npm ci
npm run lint
npm run typecheck
npm run build
```

The workflow remains secret-free. Production credentials and live public API calls do not belong in repository CI.

## Notice Snapshot Archive

`.github/workflows/monthly-notice-snapshot.yml` is the data-preservation workflow.

Scheduled mode:

```text
cron = 20 21 * * *
UTC 21:20 = KST 06:20 next day
```

Manual recovery mode:

```text
Actions
→ Notice Snapshot Archive
→ Run workflow
→ branch: main
→ month: empty for current Seoul month
→ dry_run: false
```

Safe dry-run:

- `dry_run=true`
- no public API call
- no service key requirement
- no generated-file write

Real generation:

- `dry_run=false` or scheduled trigger
- requires repository secret `DATA_GO_KR_SERVICE_KEY`
- collects current monthly-window public notices
- compares with the previous successful snapshot
- writes and commits public-safe snapshot, event, missing-state, and timeline files

Expected generated files:

```text
app/public/data/latest-notices.json
app/public/data/latest-notices.meta.json
app/public/data/monthly-notices/YYYY-MM.json
app/public/data/monthly-notices/YYYY-MM.meta.json
app/public/data/daily-events/YYYY-MM-DD.json
app/public/data/latest-events.json
app/public/data/missing-notices.json
app/public/data/notice-timelines.json
```

## Scheduled Multi-date Check

After a new automatic date:

1. confirm the run trigger is `schedule`, not `workflow_dispatch`
2. confirm the snapshot job succeeded
3. confirm a new `daily-events/YYYY-MM-DD.json` date exists
4. confirm earlier daily event files remain
5. confirm `notice-timelines.json` keeps previous events and adds newly detected events
6. confirm metadata exposes counts, truncation, warnings, and timeline totals
7. confirm the resulting bot commit deploys successfully

`DISAPPEARED` requires separate Seoul dates. Same-day reruns must not advance a missing record into that state.

## Manual Production V1 Smoke Test

Open:

```text
https://shelter-signal-ebon.vercel.app/#live
```

Check:

1. page loads without visible errors
2. data status shows `Live API` for live/cache response
3. fallback warning is hidden while `source: api`
4. region selection requests a server-filtered first page
5. `공고 더 보기` requests the next server page when available
6. D-Day and deadline labels are readable
7. desktop and mobile layouts avoid horizontal overflow

## Manual Production V2 Today-change Test

Open:

```text
https://shelter-signal-ebon.vercel.app/#changes
```

Check:

1. observation date and total change count load
2. new, deadline, status, and missing summaries match generated events
3. collection health shows last collection, current count, previous delta, page count, and missing records
4. truncation and warnings are visible when present
5. event filters work
6. an event card opens the matching cumulative timeline
7. missing-state boundary language does not imply a final outcome

## Manual Production V2 Timeline Test

Open any event or briefing card, or use:

```text
#timeline/<encoded notice key>
```

Check:

1. direct hash navigation survives refresh
2. notice summary and first/latest observation time load
3. cumulative event count is displayed
4. changed fields show previous → current values
5. return navigation works
6. timeline states that history begins when V2 preservation started

## Manual Production V2 Deadline Briefing Test

Open:

```text
https://shelter-signal-ebon.vercel.app/#briefing
```

Check:

1. D-Day, D-1, D-2, D-3 counts load
2. region filter changes the candidate count
3. deadline filter changes the list
4. candidate cards show explicit inclusion reasons
5. only the explainable top 30 are shown at once when results exceed the limit
6. card opens the cumulative notice timeline
7. telephone link appears only when a public shelter number exists
8. copy states that ranking is not an official danger score or prediction

## Manual Production API Smoke Test

Representative requests:

```text
https://shelter-signal-ebon.vercel.app/api/notices?view=current&region=서울&limit=20
https://shelter-signal-ebon.vercel.app/api/notices?view=current&region=서울&page=2&limit=20
https://shelter-signal-ebon.vercel.app/api/notices?view=urgent&region=서울&limit=20
```

Check:

- `source` is `api` for live/cache responses
- `meta.cacheStatus` is `hit`, `miss`, or `disabled`
- `meta.dateRange` reflects the current KST rolling window
- `meta.returnedCount` respects `limit`
- `meta.totalFilteredCount`, `meta.hasMore`, and `meta.nextPage` describe pagination
- `meta.fallbackReason` is absent for live/cache responses
- current and urgent rows have a valid non-expired `notice_edt`
- urgent rows have `days_left` from 0 through 3

A valid empty live result must remain:

```text
source = api
returnedCount = 0
fallbackReason = absent
```

## Fallback Check

Fallback should be used only when the live API fails or returns unusable data and no usable live cache remains.

When fallback is active:

- `source` is `fallback`
- `fallbackReason` is safe and does not expose secrets
- the Korean fallback warning is visible
- sample/static data is not presented as live

Do not intentionally break Production credentials merely to force fallback. Use local or controlled Preview verification.

## Safe Evidence Policy

Screenshots, logs, issues, and documentation must not expose:

- service keys
- `DATABASE_URL`
- connection strings or passwords
- local `.env` content
- secret-bearing upstream URLs
- private recipients or SMTP credentials
- full environment dumps

Only safe aggregate metadata, sanitized logs, generated public-safe files, and public UI states should be used as evidence.
