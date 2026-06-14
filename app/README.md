# Shelter Signal App

Vite + React + TypeScript PWA for Shelter Signal V1.5. The app presents rescued-animal public notice data with priority cues, regional exploration, saved-notice placeholders, and shelter/contact context.

Production link: https://shelter-signal-ebon.vercel.app/

## Data Loading

The deployed app loads notice data in this order:

```text
/api/notices
-> public rescued-animal API, server-side
-> PostgreSQL server fallback
-> public/data/*.json static export fallback
-> src/data/mockAnimals.ts mock fallback
```

`/api/notices` is a Vercel serverless API route. It uses
`DATA_GO_KR_SERVICE_KEY` only on the server and requests a rolling 30-day window
with `state=notice`, `_type=json`, `pageNo=1`, and `numOfRows=1000`. The browser
never receives the service key, `DATABASE_URL`, or a direct database connection.
For legacy local tooling, the server route also accepts `ANIMAL_API_KEY` as a
server-only alias. `DATA_GO_KR_SERVICE_KEY` remains the canonical deployment name.

The route treats `noticeEdt` as the public notice end date, recalculates
`days_left`, and excludes expired records from the default current-notice view.
It returns separate `currentNotices`, `urgentNotices`, `protectedAnimals`, and
optional `expiredRecords` views. Urgent notices have `days_left` between `0` and
`3` and are sorted by `days_left` and then `noticeEdt` ascending. The server
follows upstream pagination across up to 10 pages, then applies response-layer
view, region, and page filters.

```text
/api/notices?view=current&region=경기&page=1&limit=20
/api/notices?view=urgent&region=서울&page=1&limit=20
```

`view` supports `current`, `urgent`, `protected`, and `archive`. `limit`
defaults to 20 and is capped at 100. Region matching accepts common Korean
variants such as `서울`/`서울특별시`. It treats the leading administrative
region in `orgNm` as authoritative, then checks `happenPlace`, `careAddr`, and
`careNm` only when higher-priority fields do not identify a region.

The route keeps the normalized live upstream dataset in a server-only in-memory
cache for 5 minutes by default. Its base key includes the KST classification
date, live date/update ranges, upstream state, `pageNo`, and `numOfRows`.
`view`, `region`, response `page`, and `limit` are derived from that cached
dataset, so moving between filters and pages does not require another full
upstream collection while the cache is warm.

Responses include `cacheStatus`, `cacheTtlSeconds`, `cacheGeneratedAt`,
`cacheAgeSeconds`, and optional stale-refresh diagnostics. Set the server-only
`NOTICES_CACHE_TTL_SECONDS` to `0` to disable the instance cache or to a value up
to `600`. A short stale-if-error window can preserve previously fetched live
data when refresh fails; it remains `source: "api"` and is explicitly marked
`cacheStale`. This differs from PostgreSQL/static/mock fallback, which always
uses `source: "fallback"` and displays the fallback warning. Empty usable live
results are cached and never trigger fallback.

The cache never contains the service key. Vercel serverless memory is
instance-local and may be lost on a cold start, deployment, or request routed to
another function instance, so cache hits are not guaranteed across every
request.

If the public API fails, the route can query `mart.animals_clean` as a clearly
labeled fallback. If the route is unavailable, the frontend tries static JSON and
then mock data. Static/mock rows pass through the same current-date classifier, so
expired records never appear in the default view. A valid live response with zero
current notices remains empty instead of triggering fallback.

Fallback starts only for a missing key, upstream HTTP/API error, empty upstream
body, request failure, or an unusable response whose records contain no valid
`noticeEdt`. PostgreSQL fallback connections and queries have explicit timeouts.
Static exports keep their original dates and are filtered. Mock dates are shifted
relative to the current KST date so mock fallback remains visibly useful without
pretending to be live.

Fallback metadata uses `source: "fallback"`, an ISO `fetchedAt`, the rolling
`dateRange`, and a warning. The UI displays:

```text
공공데이터 API 응답이 불안정하여 샘플 데이터를 표시 중입니다. 실시간 공고가 아닐 수 있습니다.
```

Safe response diagnostics include `source`, `fetchedAt`, `dateRange`,
`requestState`, `itemCount`, `filteredCount`, `returnedCount`, `urgentCount`,
`pagesFetched`, `upstreamTotalCount`, `responseFormat`, `truncated`, `viewLimit`,
`totalFilteredCount`, `hasMore`, `nextPage`, `cacheStatus`, `cacheTtlSeconds`,
`cacheGeneratedAt`, and `fallbackReason`.

The UI renders those diagnostics in a compact Korean-first status panel. Notice
lists start with a server-filtered 20-row page. Region changes request page 1
again, while "공고 더 보기" requests and appends the next server page. The urgent
view puts the region filter before the list and preserves `days_left` ascending
order. Thousands of public rows are not rendered at once.

A valid live query with no rows remains `source: "api"` and shows a normal empty
state. It never triggers sample fallback. Fallback remains limited to live API
failure or unusable upstream data and is always explicitly labeled.

Known limitations: the public API can be affected by service approval, quotas,
intermittent non-JSON errors, and agency update timing. Each upstream page is
capped at 1000 rows and the route follows at most 10 pages. Response pagination
is applied after collecting the available upstream window, so a cache miss can
still call several upstream pages. The short cache is instance-local and cannot
guarantee hits across Vercel cold starts or different serverless instances.

Shelter/contact context is handled separately through `/api/shelters`. That route calls the data.go.kr rescued-animal notice API server-side and derives shelter summaries from notice fields such as `careNm`, `careTel`, `careAddr`, and `orgNm`. It is notice-derived context, not a complete official shelter directory.

## Production Live-first Verification

On 2026-06-12, the freshness-first preview returned `source: "api"`, while the
then-current Production deployment still returned the old
`source: "operational-postgres"` response. Production was subsequently
redeployed with the live-first pipeline and verified through `/api/notices` and
the browser UI.

```text
public rescued-animal API
-> Vercel /api/notices
-> React PWA
-> PostgreSQL fallback
-> static JSON fallback
-> mock fallback
```

The Production UI shows `Live API` and hides the Korean fallback warning when the
public API succeeds. Vite-only development is expected to show explicitly
labeled fallback unless the serverless API/proxy is running. Public API quotas,
XML/plain-text errors, update-cycle differences, valid empty results, and the
maximum page cap remain known limitations.

## Local Development

```powershell
npm install
npm run dev
npm run build
```

`npm run dev` starts Vite only. Because Vite does not execute `app/api/*.ts`,
the browser will show static/mock fallback when no API dev server is running.
To verify the live serverless notice route and UI locally, link/configure the
Vercel project, then run these in separate terminals:

```powershell
npm run dev:api
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:4174` by default. Override that target
with `VITE_API_PROXY_TARGET` when needed.

If `npm` is not available on PATH but dependencies are installed, these commands can be used for local build checks:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
```

## Vercel Settings

Deploy the `app` folder as the Vercel project root:

```text
Root Directory: app
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Server-side environment variables:

```text
DATA_GO_KR_SERVICE_KEY=  # required for live public API
DATABASE_URL=            # optional PostgreSQL fallback
NOTICES_CACHE_TTL_SECONDS=300  # optional, server-only; 0 disables, max 600
```

`DATA_GO_KR_SERVICE_KEY` is used server-side by `/api/notices` and
`/api/shelters`. `DATABASE_URL` is used only by the `/api/notices` PostgreSQL
fallback. `NOTICES_CACHE_TTL_SECONDS` controls only the server-side normalized
notice cache. Do not add a `VITE_` prefix to these values, because they must not
be exposed to browser code.

## Troubleshooting

For `/api/notices`:

- `source: "api"`: the public API succeeded and returned usable rows.
- `source: "fallback"`: inspect the safe `fallbackReason` for a missing key,
  upstream error/shape problem, or request failure.
- A valid empty live result remains live and does not silently switch to samples.
- PostgreSQL is optional and is attempted only after the live public API fails.

For `/api/shelters`:

- `MISSING_SERVICE_KEY`: the Vercel Function cannot see `DATA_GO_KR_SERVICE_KEY`.
- `UPSTREAM_ERROR`: the route called the upstream API but the response or permission state failed.
- `UPSTREAM_FORBIDDEN`: data.go.kr returned `403`; check service approval, operation path, required parameters, key encoding, and accidental whitespace.
- Direct check: https://shelter-signal-ebon.vercel.app/api/shelters
- Local diagnosis: `python scripts/test_shelter_upstream_request.py`

## Current Product Boundary

The app includes a landing view, golden-time priority view, notice filtering, region exploration, a notice detail sheet, and shelter contact guidance.

Auth, real email/SMS alerts, n8n production automation, subscription management, and production monitoring are intentionally out of scope. V2/n8n work is limited to digest preview and dry-run verification.
