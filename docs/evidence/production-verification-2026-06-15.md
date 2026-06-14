# Shelter Signal Production Verification Evidence

Evidence date: **2026-06-15 KST**

Production: https://shelter-signal-ebon.vercel.app/

Repository baseline:

```text
main / origin/main
b09b1ea63ddb054ca6b262b01cd8df23a37ac0ba
```

## What Was Verified

### Production UI

![Shelter Signal live-first Production UI](../screenshots/10-live-first-production-ui-2026-06-15.png)

The Production UI showed:

- `Live API`
- KST date range `2026-05-16 ~ 2026-06-15`
- 3 collected upstream pages
- 2,831 normalized/current rows in the full response scope
- 20 rows rendered initially
- cache `hit`
- no fallback warning
- no browser console error or warning during the smoke test

The screenshot intentionally shows the data status panel and product overview rather than raw notice rows or contact details.

### Production API Metadata

Representative endpoint:

```text
/api/notices?view=current&region=서울&limit=20
```

Verified safe metadata:

- `source: "api"`
- `fallbackReason: null`
- `cacheStatus: "hit"`
- `pagesFetched: 3`
- `normalizedItemCount: 2831`
- `returnedCount: 20`
- `totalFilteredCount: 185`
- `hasMore: true`
- `nextPage: 2`

Freshness and urgency checks:

- current expired or missing-deadline leak: `0`
- urgent expired, missing-deadline, or out-of-range leak: `0`
- urgent sorted by `days_left` ascending: `true`
- urgent `days_left` range: `0` through `3`

See [production-api-metadata-2026-06-15.json](production-api-metadata-2026-06-15.json) for the archived safe metadata snapshot.

### GitHub Actions Verify

Public run:

https://github.com/dffxonnb-cyber/shelter-signal/actions/runs/27514096587

Verified:

- workflow: `Verify`
- trigger: push to `main`
- head SHA: `b09b1ea63ddb054ca6b262b01cd8df23a37ac0ba`
- result: `success`
- `npm ci`: success
- lint: success
- typecheck: success
- build: success
- no secret or environment-variable references in the workflow

See [github-actions-verify-2026-06-15.json](github-actions-verify-2026-06-15.json).

### Live-first Architecture Boundary

The runtime evidence supports the documented current architecture:

```text
public notice API
→ Vercel /api/notices
→ normalized live-data cache
→ KST freshness and view separation
→ server-side region and page filtering
→ React PWA
```

The successful response used `source: "api"`. PostgreSQL, static JSON, and mock data remain fallback or local validation paths and are not presented as the current Production primary source.

## What Was Not Verified

This smoke test does not fully validate:

- completeness or correctness of every upstream notice row
- source-agency update timing
- every region, page, date override, or fallback combination
- long-term availability, quota capacity, or SLA
- real-world rescue, adoption, or public-service outcomes

The evidence verifies the live API operating boundary at the recorded time, not the quality of the entire upstream dataset.

## Why This Evidence Is Public-safe

- The API snapshot contains metadata and aggregate checks only; it does not include notice rows.
- The UI screenshot contains no service key, environment value, raw upstream URL, or contact detail.
- The GitHub Actions snapshot contains only public workflow status and step results.
- A response scan found no service key name/value, `DATABASE_URL`, PostgreSQL connection string, or full upstream API URL.

## Historical Evidence Separation

`08-operational-db-badge.png` and `09-api-notices-operational-response.png` remain archived evidence of an earlier PostgreSQL-primary stage. They do not represent the current live-first Production architecture.
