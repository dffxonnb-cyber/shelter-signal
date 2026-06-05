# Shelter Signal

**Shelter Signal은 공공데이터 구조동물 공고를 “먼저 확인할 공고”와 “보호소 연락 맥락”으로 재구성한 모바일 PWA 포트폴리오 프로젝트입니다.**

배포 링크: https://shelter-signal-ebon.vercel.app/

Shelter Signal V1은 production shelter service가 아니라 **portfolio-ready PWA prototype**입니다. 실제 사용자 계정, 저장 persistence, 실시간 운영 backend, push/email/SMS 알림, production n8n 자동화는 포함하지 않습니다. 대신 공공데이터 기반 문제를 데이터 파이프라인, SQL 모델링, 정적 export, PWA UX, Vercel serverless API로 끝까지 연결한 데이터 제품형 MVP를 보여줍니다.

## Portfolio Snapshot

| 항목 | 내용 |
| --- | --- |
| 한 줄 정의 | 공공데이터 구조동물 공고 우선순위/보호소 연락 맥락 PWA |
| 핵심 사용자 질문 | 오늘 먼저 확인해야 할 공고는 무엇이고, 공식 문의에 필요한 보호소 정보는 어디에 있는가? |
| V1 구현 범위 | 모바일 PWA, Rescue Window Score, 공고 필터, 지역 신호, 상세 시트, Vercel `/api/shelters` |
| 데이터 전략 | `/api/notices?limit=100` operational DB read path를 먼저 사용하고, 실패 시 static JSON → mock 순서로 fallback |
| API 보안 | 브라우저는 `DATABASE_URL`이나 공공데이터 API key를 보지 않고, Vercel serverless routes만 서버 환경 변수를 읽음 |
| 포트폴리오 문서 | [docs/portfolio-case-study.md](docs/portfolio-case-study.md) |

## What It Shows

- 구조동물 공고를 단순 최신순 목록이 아니라 `긴급 확인`, `곧 종료`, `확인 필요` 같은 우선순위 신호로 정리합니다.
- Rescue Window Score를 사용해 보호 종료일, 사진 여부, 연락처 여부 등 확인 신호를 설명 가능한 방식으로 UI에 연결합니다.
- 공고 목록, 필터, 표시 수 조절, 지역 탐색, 상세 시트, 보호소 문의 안내까지 하나의 모바일 중심 PWA 흐름으로 구성합니다.
- 공공데이터 API key를 browser bundle에 넣지 않고, Vercel `/api/shelters` route가 서버에서 data.go.kr 구조동물 공고 API를 호출합니다.
- 보호소 연락 목록은 별도 공식 보호소 디렉터리가 아니라 공고 행의 `careNm`, `careTel`, `careAddr`, `orgNm`에서 만든 notice-derived summary임을 명확히 표시합니다.
- operational DB 응답이 없거나 실패하면 static JSON으로, static JSON도 실패하면 앱 내부 mock 데이터로 fallback해 화면이 안전하게 동작하도록 설계했습니다.

## Data Flow

```text
Public API / mock data
→ PostgreSQL raw table
→ SQL models and tests
→ Rescue Window Score
→ /api/notices
→ Vite React PWA primary data
```

```text
/api/notices unavailable or empty
→ static JSON export fallback
→ mock fallback
```

```text
PWA region selector
→ /api/shelters
→ Vercel Serverless Function
→ data.go.kr rescued-animal notice API
→ notice-derived shelter/contact summaries
```

브라우저 앱은 PostgreSQL이나 data.go.kr API에 직접 연결하지 않습니다. 공고 목록은 먼저 `/api/notices?limit=100`을 호출하고, 이 Vercel route가 서버 환경 변수 `DATABASE_URL`로 PostgreSQL의 `mart.animals_clean` view를 조회합니다. `/api/notices`가 실패하거나 `MISSING_DATABASE_URL`, `DB_QUERY_ERROR`, 빈 notices 배열을 반환하면 앱은 `app/public/data/*.json` 정적 export로 fallback합니다. 정적 JSON도 실패하면 `src/data/mockAnimals.ts`의 mock 데이터로 fallback합니다.

지역 보호소 연락 맥락은 프론트엔드가 `/api/shelters?sido=...&sigungu=...`만 호출합니다. 이 route는 서버 환경 변수 `DATA_GO_KR_SERVICE_KEY`를 읽어 공공데이터 API와 통신하고, 화면에는 공고에 포함된 보호소명, 전화번호, 주소, 관할기관 필드만 정규화해 전달합니다. 이 V1 live route에는 별도 데이터베이스 연결이 필요하지 않습니다.

## Screenshots

| Landing | App Home |
| --- | --- |
| ![Shelter Signal landing hero](docs/screenshots/01-landing-hero.png) | ![Shelter Signal app preview home](docs/screenshots/02-app-preview-home.png) |

| Golden Time | Notice Filters |
| --- | --- |
| ![Golden time notices](docs/screenshots/03-golden-time.png) | ![Notice filters and display control](docs/screenshots/04-notices-filter.png) |

| Region Explorer | Detail Sheet |
| --- | --- |
| ![Region explorer](docs/screenshots/05-region-explorer.png) | ![Notice detail sheet](docs/screenshots/06-detail-sheet.png) |

| Data Pipeline |
| --- |
| ![Data pipeline section](docs/screenshots/07-data-pipeline.png) |

## Features

- **Home signal**: 프로젝트 정체성, 정적 데이터 상태, 우선 확인 공고 요약
- **Golden Time list**: `긴급 확인`, `곧 종료` 공고 중심 리스트
- **Notice filters**: Rescue Window 라벨, 축종, 지역 필터
- **Notice display control**: 필터 결과 중 `5개`, `10개`, `20개`, `전체` 표시 선택
- **Region explorer**: 시/도 → 시/군/구 드롭다운 기반 지역별 공고 신호 탐색
- **Shelter lookup**: 내부 API route를 통한 공고 기반 보호소 연락 맥락 조회와 안전한 실패 상태 표시
- **Detail sheet**: 공식 공고 정보, 동물 정보, 보호소 및 연락처 그룹화
- **Contact actions**: 전화번호 보기, 주소 확인, 공식 문의 안내
- **Saved placeholder**: 추후 저장 및 알림 기능을 위한 자리
- **PWA assets**: manifest, service worker, SVG icon, OG image metadata

## Tech Stack

- **Frontend**: Vite, React, TypeScript
- **Serverless API**: Vercel Functions under `/app/api`
- **PWA**: Web manifest, service worker, SVG app assets
- **Data**: Python, PostgreSQL, SQL
- **Pipeline**: Docker Compose, ingestion script, validation script
- **Modeling**: SQL migrations, SQL models, SQL tests
- **Export bridge**: Python static JSON export
- **Validation**: TypeScript build, Vite build, browser smoke test, `git diff --check`

## Current Status

This is a portfolio-ready PWA prototype, not a production shelter service.

Implemented:

- Mobile-first React PWA
- Operational `/api/notices?limit=100` data loading from `mart.animals_clean`
- Static JSON fallback loading from `app/public/data/*.json`
- Mock data fallback when exported JSON cannot load
- Rescue Window Score display and sorting
- Notice filters and display count control
- Region signal explorer
- Internal `/api/shelters` route for notice-derived shelter/contact summaries when `DATA_GO_KR_SERVICE_KEY` is configured
- `/api/notices` operational DB route connected as the frontend primary notice source
- Detail sheet with official notice and shelter contact fields
- Deployment-ready Vite app under `/app`

Not implemented:

- Live production backend
- User accounts or authentication
- Persisted saved notices
- Push, email, or SMS notifications
- n8n automation in the deployed app
- Shelter homepage, operating-hours, or coordinate enrichment
- Production monitoring

## Operational DB Read Path

현재 구조: Shelter Signal V2는 공고 목록을 먼저 operational PostgreSQL route에서 읽습니다. 프런트엔드는 `/api/notices?limit=100`만 호출하고, 이 server-only route가 배포 환경의 `DATABASE_URL`을 읽어 PostgreSQL을 조회합니다. `DATABASE_URL`은 browser code에 노출하지 않습니다.

fallback 구조: `/api/notices`가 실패하거나, `DATABASE_URL`이 없거나, DB query가 실패하거나, 빈 notices 배열을 반환하면 기존 `app/public/data/*.json` static export를 읽습니다. static JSON도 실패하면 mock 데이터로 fallback합니다.

스키마 가정: `/api/notices`는 현재 `sql/models/001_animals_clean.sql`에 정의된 notice-level SQL view인 `mart.animals_clean`을 조회합니다. 선택 필드는 기존 `animals.json` export shape와 최대한 맞춰, operational path가 실패해도 정적 PWA bridge가 안정적으로 유지되도록 합니다.

이 기반이 필요한 이유:

- 최신 공고 조회
- 이후 실제 저장 공고 기능
- 마감일 기반 alert candidate
- 지역 signal refresh
- n8n automation foundation

현재 한계:

- auth 없음
- persisted saved notices 없음
- push/email/SMS notification 없음
- production monitoring 없음
- static JSON은 primary가 아니라 operational DB 실패 시 fallback source로 유지됨

## API/Data Notes

The app currently uses public rescue animal notice fields that are already present in the notice data, including:

- `careNm`
- `careTel`
- `careAddr`
- `orgNm`

For live shelter lookup, Shelter Signal uses rescued-animal notice rows as the primary source:

- Public data source: 농림축산식품부 농림축산검역본부_국가동물보호정보시스템 구조동물 조회 서비스
- Notice endpoint used by the serverless route: `abandonmentPublicService_v2/abandonmentPublic_v2`
- Server-only environment variable: `DATA_GO_KR_SERVICE_KEY`
- Frontend entrypoint: `/api/shelters?sido=...&sigungu=...`

The service key must be configured in Vercel as `DATA_GO_KR_SERVICE_KEY`. Do not prefix it with `VITE_` or expose it in frontend code. Local secret files such as `.env` should remain uncommitted; `.env.example` only documents required keys.

Rows are deduplicated by `careNm + careTel + careAddr`. This avoids blocking the app on the separate shelter-center endpoint when that endpoint returns `403`.

The notice endpoint supports region code parameters such as `upr_cd` and `org_cd`. Shelter Signal keeps the UI labels in Korean, sends known stable codes when available, and lets the internal API route resolve missing codes through the public `sido_v2` and `sigungu_v2` helper endpoints before calling `abandonmentPublic_v2`.

The route returns JSON with a stable shape:

```json
{ "ok": true, "shelters": [], "source": "rescued-animal-notice-derived" }
```

If the key is missing, it returns:

```json
{ "ok": false, "code": "MISSING_SERVICE_KEY", "shelters": [] }
```

If the upstream public-data API fails, it returns:

```json
{
  "ok": false,
  "code": "UPSTREAM_ERROR",
  "upstreamStatus": 403,
  "message": "...",
  "upstreamError": {
    "rawSnippet": "..."
  },
  "shelters": []
}
```

The upstream diagnostic body is sanitized and never includes the raw service key.

The internal API route normalizes shelter responses into this frontend shape:

```ts
type Shelter = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  jurisdiction?: string;
  orgName?: string;
  source: "rescued-animal-notice-derived";
  raw?: unknown;
};
```

This notice-derived list is not a complete official shelter directory. It is shelter/contact context extracted from rescued-animal notices. Missing service keys, permission errors such as `403`, XML responses, empty lists, and network failures are handled as loading/error/empty states in the UI instead of crashing the app.

Do not assume support for shelter homepage URLs, operating hours, latitude/longitude coordinates, or detailed facility metadata until the actual API response shape and permissions are confirmed. Shelter Signal does not include real API keys, and `.env` files should remain local.

Rescue Window Score is an internal exploration signal. It is not an official risk score, adoption prediction, or legal/public-agency status.

## Local Development

### App

```powershell
cd app
npm install
npm run dev
npm run build
```

For local API-route testing through Vercel, configure local secrets outside git:

```text
DATABASE_URL=
DATA_GO_KR_SERVICE_KEY=
```

### Data Pipeline

```powershell
docker compose up -d
python scripts/validate_pipeline.py
python scripts/export_app_data.py
```

Generated app data is written to:

```text
app/public/data/animals.json
app/public/data/region_summary.json
app/public/data/rescue_window_summary.json
app/public/data/shelter_summary.json
app/public/data/kind_summary.json
```

## Vercel Deployment

The Vite app lives in `/app`, not the repository root.

```text
Root Directory: app
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Production notice loading through `/api/notices` requires `DATABASE_URL` in Vercel. If it is missing or the DB query fails, the app falls back to static JSON and then mock data. Production shelter lookup through `/api/shelters` requires the `DATA_GO_KR_SERVICE_KEY` environment variable in Vercel. Without it, the main notice UI still renders, but selected-region shelter lookup shows a safe API error state. The deployed app does not require auth, n8n, email, or SMS configuration.

After adding or changing Vercel environment variables, redeploy Production so the serverless function receives the new value.

### Troubleshooting `/api/shelters`

- `MISSING_SERVICE_KEY` means the Vercel Function cannot see `DATA_GO_KR_SERVICE_KEY`.
- Confirm the exact variable name: `DATA_GO_KR_SERVICE_KEY`.
- Confirm the variable is enabled for the Production environment.
- Redeploy Production after adding or changing the variable.
- Test the route directly: https://shelter-signal-ebon.vercel.app/api/shelters
- `UPSTREAM_ERROR` means the function has a key, but data.go.kr rejected or failed the rescued-animal notice request. Check service approval/permission for the notice endpoint before assuming live data is unavailable.
- `UPSTREAM_FORBIDDEN` means data.go.kr returned `403`. Common causes include service-specific approval not yet active, wrong endpoint or operation path, missing required parameters, Encoding/Decoding key mismatch, double-encoded `serviceKey`, or extra spaces/quotes in the environment value.
- If the separate shelter-center API is blocked, `/api/shelters` still uses the rescued-animal notice API and derives shelter summaries from `careNm`, `careTel`, `careAddr`, and `orgNm`.
- Use `python scripts/test_shelter_upstream_request.py` to compare the local rescued-animal notice upstream request shape without printing the key.

No database connection is required for this live shelter lookup route. The browser calls the internal Vercel API route, and only that serverless function calls data.go.kr.

### Troubleshooting `/api/notices`

- `MISSING_DATABASE_URL` means the Vercel Function cannot see `DATABASE_URL`.
- `DB_QUERY_ERROR` means the route has a database URL, but querying `mart.animals_clean` failed.
- Empty `notices` results are treated as unavailable by the frontend and trigger static JSON fallback.
- The browser never receives `DATABASE_URL`; it only calls `/api/notices?limit=100`.
- The static files in `app/public/data/*.json` remain the safe fallback path when operational DB reads are unavailable.

## Portfolio Description

Shelter Signal은 공공데이터 구조동물 공고 API와 로컬 SQL 모델링을 기반으로, 보호 종료가 가까운 공고와 보호소 연락 맥락을 먼저 확인할 수 있게 정리한 모바일 PWA입니다. 공고 목록은 Vercel `/api/notices` route를 통해 operational PostgreSQL을 먼저 읽고, 실패 시 정적 JSON export와 mock 데이터로 fallback합니다. 선택 지역의 보호소 연락 맥락은 별도 Vercel serverless API route가 공공데이터 API를 서버에서 호출해 notice-derived summary로 제공합니다.

Key highlights:

- 공공데이터 기반 구조동물 공고 탐색 경험 설계
- Rescue Window Score를 통한 우선 확인 흐름 제안
- PostgreSQL/SQL 모델링에서 PWA까지 이어지는 end-to-end 데이터 제품 MVP
- Vercel 내부 API route로 공공데이터 서비스 키를 숨기고 notice-derived 보호소 연락 맥락 제공
- operational DB, 정적 JSON fallback, live shelter API route의 역할을 분리한 portfolio demo
- operational DB가 없을 때도 static/mock fallback으로 깨지지 않는 공고 탐색 흐름

## Next Steps

- `v2/n8n-email-alerts` 브랜치를 `main`의 최신 V1 live API 개선사항과 동기화
- Docker Desktop 실행 후 `python scripts/validate_pipeline.py` 재검증
- `python scripts/run_daily_digest_dry_run.py` 재검증
- 배포 환경의 `DATABASE_URL` 설정과 `/api/notices` operational read 안정성 검증
- `mart.alert_candidates` 기반 digest preview 품질 확인
- 저장 기능과 실제 알림 흐름은 별도 단계에서 설계
