# Notice Change Event Schema

Shelter Signal V2 records **collector-observed changes** between successful public-data snapshots. These events describe what the collector saw. They do not prove adoption, transfer, euthanasia, or another final animal outcome.

## Stable notice key

The event pipeline uses the first available public identifier:

1. `desertion_no` → `desertion:<value>`
2. `notice_no` → `notice:<value>`

Rows without either identifier are excluded from event comparison and reported in diagnostics.

## Event types

| Type | Meaning |
| --- | --- |
| `NEW` | Present in the current successful snapshot but not in the previous one |
| `DEADLINE_CHANGED` | `notice_edt` changed |
| `STATUS_CHANGED` | `process_state` changed |
| `BECAME_URGENT` | `days_left` crossed from more than 3 days to 0–3 days |
| `NOT_OBSERVED` | Missing from one successful collection inside the same monthly observation window |
| `DISAPPEARED` | Still missing on a second distinct Seoul date; remains an observation state, not a confirmed outcome |
| `RETURNED` | A previously missing notice was observed again |

## Generated files

```text
app/public/data/latest-events.json
app/public/data/daily-events/YYYY-MM-DD.json
app/public/data/missing-notices.json
```

- `latest-events.json` contains events from the most recent collector run.
- `daily-events/YYYY-MM-DD.json` merges all unique events generated on that Seoul date, so a second manual run does not erase earlier events.
- `missing-notices.json` is a compact state file used to distinguish a first missing observation, repeated disappearance, and return.

The monthly and latest snapshot metadata files also include event counts, missing-record counts, file paths, and comparison diagnostics.

## Observation-window boundary

The snapshot collector currently queries one calendar month at a time. When `snapshotId` changes at a month boundary, the event pipeline does not mark every notice missing from the previous month as `NOT_OBSERVED`. This prevents a changed query window from creating a false mass-disappearance event.

## Safety boundary

- A missing notice is not treated as proof of a final outcome.
- Event files contain public-safe normalized fields only.
- Service keys, database URLs, tokens, and full upstream request URLs are not written.
- The first run without a previous snapshot is treated as a baseline and does not emit thousands of artificial `NEW` events.

## Local validation

```powershell
npm run snapshot:check
npm run snapshot:test
npm run snapshot:dry-run
```

The self-test covers all seven event types, same-day event merging, missing-state transitions, return detection, and month-window reset protection without calling the external API.
