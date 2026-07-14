# Shelter Signal V2 Production Verification · 2026-07-14 KST

## Purpose

This document records the first public-safe Production verification of the Shelter Signal V2 preservation and history-aware product path.

It verifies the repository and deployed product behavior that can be demonstrated without exposing service keys, database URLs, private recipients, full upstream request URLs, or raw private infrastructure data.

## Verified Product Boundary

V1 remains the live-first current-notice product:

```text
browser
→ Vercel /api/notices
→ normalized short cache
→ data.go.kr public notice API
→ current / urgent / protected / archive
```

V2 adds a separate history layer:

```text
GitHub Actions scheduled or manual collection
→ public-safe snapshot
→ previous/current comparison
→ daily change events and missing state
→ cumulative notice timelines
→ today-change dashboard and deadline briefing
```

V2 does not send real email, SMS, or push notifications.

## GitHub Actions Collection Verification

Workflow: `Notice Snapshot Archive`

Verified manual execution settings:

```text
branch = main
month = empty, current Seoul month
 dry_run = false
```

Observed result:

- workflow conclusion: success
- snapshot job conclusion: success
- public API collection completed
- generated data committed and pushed by `github-actions[bot]`
- Node.js 20 deprecation annotation was informational and did not fail the job

Scheduled configuration:

```text
cron = 20 21 * * *
UTC 21:20 = KST 06:20 on the following day
```

The first multi-date automatic execution remains a follow-up operational check. Manual live executions verified the same production path used by the schedule.

## Verified Snapshot Metadata

Latest verified metadata timestamp:

```text
generatedAt = 2026-07-14T05:45:47.904Z
generatedAtKst = 2026. 7. 14. PM 2:45:47
snapshotId = 2026-07
```

Collection summary:

```text
pagesFetched = 3
upstreamTotalCount = 2,172
itemCount = 2,172
normalizedItemCount = 2,172
currentCount = 2,172
urgentCount = 879
truncated = false
warnings = []
```

This confirms that the verified run did not hit the configured page cap and did not record a collection warning. It does not prove that the upstream public dataset is complete or perfectly synchronized with field operations.

## Verified Change Events

The first live comparison on 2026-07-14 produced:

```text
NEW = 15
NOT_OBSERVED = 4
DEADLINE_CHANGED = 0
STATUS_CHANGED = 0
BECAME_URGENT = 0
DISAPPEARED = 0
RETURNED = 0
total = 19
```

A later same-day recovery run produced zero new latest-run events because the snapshot had not changed. The daily event file preserved the earlier 19 events, confirming that same-day reruns do not erase previous observations.

`NOT_OBSERVED` is a collector state. It does not prove adoption, return, transfer, euthanasia, notice closure, or another final animal outcome.

## Verified Notice Timelines

The cumulative timeline bootstrap produced:

```text
noticeCount = 19
eventCount = 19
latestObservationDate = 2026-07-14
```

Verified behavior:

- events are grouped by stable notice key
- `desertion_no` is preferred and `notice_no` is the fallback
- `eventId` prevents duplicate accumulation
- same-day daily event history can bootstrap the first timeline file even when the newest run has zero changes
- each timeline stores public-safe notice summary fields and cumulative events

The timeline starts when Shelter Signal V2 began preserving change events. It is not a reconstruction of the animal's complete historical record before 2026-07-14.

## Verified Product Surfaces

### V1 Current Notices

Route:

```text
#live
```

Expected checks:

- live/cache/fallback state is visible
- current, urgent, protected, and archive views remain available
- region filtering and pagination remain unchanged

### V2 Today Changes

Route:

```text
#changes
```

Expected checks:

- today-change totals
- collection health and comparison counts
- event-type filters
- event cards linked to cumulative timelines
- missing-state safety language

### V2 Notice Timeline

Route pattern:

```text
#timeline/<encoded stable notice key>
```

Expected checks:

- first and latest observation time
- cumulative event count
- event type history
- before and after values for changed fields

### V2 Deadline Briefing

Route:

```text
#briefing
```

Expected checks:

- D-Day, D-1, D-2, and D-3 summaries
- today-new urgent and deadline-advanced reasons when present
- region and deadline filters
- top 30 explainable review order
- links to cumulative notice timelines

The briefing order is not an official risk score, euthanasia prediction, or adoption probability.

## Repository Verification

The V2 implementation PRs passed repository verification before merge:

- scheduled public-data snapshot automation
- observation change-event pipeline
- today-change dashboard
- per-notice cumulative timeline
- timeline same-day bootstrap fix
- evidence-backed deadline briefing

CI checks:

```text
snapshot script syntax = pass
change-event self-test = pass
timeline accumulation and deduplication self-test = pass
snapshot dry-run = pass
app lint = pass
TypeScript typecheck = pass
production build = pass
Vercel preview = success
```

## Generated Public-safe Files

```text
app/public/data/latest-notices.json
app/public/data/latest-notices.meta.json
app/public/data/monthly-notices/2026-07.json
app/public/data/monthly-notices/2026-07.meta.json
app/public/data/daily-events/2026-07-14.json
app/public/data/latest-events.json
app/public/data/missing-notices.json
app/public/data/notice-timelines.json
```

These files must not contain service keys, database URLs, access tokens, private recipients, or full secret-bearing upstream URLs.

## Evidence Boundary

This evidence confirms:

- live public API snapshot collection succeeded
- generated snapshot metadata is public-safe
- same-day event preservation works
- cumulative timeline bootstrap works
- V2 product surfaces compile and deploy
- collection quality warnings and truncation are exposed instead of hidden

This evidence does not confirm:

- complete upstream public-data history
- perfect agreement with field shelter operations
- a final outcome for a missing notice
- every date, region, and failure combination
- the first next-day scheduled run
- real notification delivery, recipients, subscription management, monitoring, or SLA

## Remaining Completion Check

After the next 06:20 KST scheduled execution:

1. confirm the workflow ran without manual trigger
2. confirm a new `daily-events/YYYY-MM-DD.json` date was generated
3. confirm `notice-timelines.json` retained previous events and added new ones when detected
4. confirm V2 screens still load after the automated data commit and deployment

Once that check passes, the V2 implementation can be treated as operationally closed for the current portfolio scope.
