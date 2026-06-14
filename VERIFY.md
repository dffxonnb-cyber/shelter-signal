# Shelter Signal Verification Guide

## Verification Boundary

Repository verification and Production smoke testing have different purposes.

- CI/local verification checks that the tracked application can lint, typecheck, and build without secrets or external API calls.
- Production smoke testing checks whether the deployed UI and `/api/notices` currently operate through the live-first boundary.
- Neither step proves the completeness, correctness, or update timing of the entire upstream public dataset.

Archived public-safe Production evidence:

- [2026-06-15 Production verification](docs/evidence/production-verification-2026-06-15.md)
- [Safe API metadata snapshot](docs/evidence/production-api-metadata-2026-06-15.json)
- [GitHub Actions Verify PASS snapshot](docs/evidence/github-actions-verify-2026-06-15.json)

## Secret-free Repository Verification

Run from the repository root:

```powershell
cd app
npm ci
npm run lint
npm run typecheck
npm run build
cd ..
git diff --check
```

These commands do not require:

- `DATA_GO_KR_SERVICE_KEY`
- `DATABASE_URL`
- `NOTICES_CACHE_TTL_SECONDS`
- external public API access

The Vite build compiles the frontend and serverless TypeScript routes. It does not call the public API during build.

## GitHub Actions

`.github/workflows/verify.yml` runs on pushes to `main` and pull requests.

It uses `app` as the working directory and runs:

```text
npm ci
npm run lint
npm run typecheck
npm run build
```

The workflow must remain secret-free. Live API calls and Production credentials do not belong in repository CI.

## Manual Production UI Smoke Test

Open:

```text
https://shelter-signal-ebon.vercel.app/
```

Check:

1. The page loads without console errors.
2. The data status panel shows `Live API` for a successful live/cache response.
3. The fallback warning is hidden while `source: "api"` is active.
4. Region selection requests a server-filtered result.
5. `공고 더 보기` requests the next server page when `hasMore` is true.
6. Desktop, tablet, and mobile layouts do not introduce obvious horizontal overflow.

## Manual Production API Smoke Test

Representative requests:

```text
https://shelter-signal-ebon.vercel.app/api/notices?view=current&region=서울&limit=20
https://shelter-signal-ebon.vercel.app/api/notices?view=current&region=서울&page=2&limit=20
https://shelter-signal-ebon.vercel.app/api/notices?view=urgent&region=서울&limit=20
```

Check the response:

- `source` is `api` for live/cache responses.
- `meta.cacheStatus` is `hit`, `miss`, or `disabled`.
- `meta.dateRange` reflects the current KST rolling window.
- `meta.itemCount` or `meta.normalizedItemCount` reports collected normalized rows.
- `meta.returnedCount` respects `limit`.
- `meta.totalFilteredCount`, `meta.hasMore`, and `meta.nextPage` describe pagination.
- `meta.fallbackReason` is absent for live/cache responses.
- current/urgent rows have a valid `notice_edt` and are not expired.
- urgent rows have `days_left` from 0 through 3 and remain deadline-sorted.

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

Do not intentionally break Production credentials merely to force this state. Use local or controlled Preview verification when a fallback test is required.

## Safe Evidence Policy

Screenshots, logs, issues, and documentation must not expose:

- service keys
- `DATABASE_URL`
- connection strings or passwords
- local `.env` content
- secret-bearing upstream URLs
- full environment dumps

Only safe response metadata, sanitized logs, and public UI states should be used as evidence.
