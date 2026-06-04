# Shelter Signal

Shelter Signal은 **공공데이터 구조동물 공고 기반 보호소 연락 맥락 PWA**입니다. 구조동물 공고를 모바일에서 빠르게 훑고, 보호 종료가 가까운 공고와 공고에 포함된 보호소 연락 정보를 먼저 확인할 수 있도록 정리합니다.

배포 링크: https://shelter-signal-ebon.vercel.app/

현재 공고와 지역 신호 데이터는 `app/public/data/*.json`으로 export된 정적 JSON을 우선 사용합니다. 지역 보호소 연락 맥락은 Vercel 내부 API route인 `/api/shelters`가 data.go.kr 구조동물 공고 API를 호출하고, 공고 행의 `careNm`, `careTel`, `careAddr`, `orgNm` 값을 추출해 제공합니다. 서비스 키는 서버 환경 변수로만 읽으며, 이 V1 live API route에는 별도 데이터베이스 연결이 필요하지 않습니다. 운영용 실시간 backend, 사용자 계정, 실제 저장 기능, email/SMS 알림, n8n 자동화가 붙은 production-ready 서비스는 아닙니다.

## Overview

Shelter Signal은 보호소 연락 맥락의 접근성을 높이기 위한 모바일 중심 서비스 실험입니다. 공공데이터와 로컬 데이터 파이프라인을 기반으로 구조동물 공고를 정리하고, React PWA 화면에서 탐색 가능한 형태로 제공합니다.

저장소는 데이터 수집 점검, PostgreSQL 적재, SQL 모델링, 정적 JSON export, Vite React 앱, Vercel 서버리스 API까지 이어지는 데이터 제품형 MVP를 목표로 합니다.

## Problem

구조동물 공고는 공고 종료일, 보호소 연락처, 지역, 사진 여부 같은 정보가 흩어져 있어 사용자가 우선 확인할 공고를 빠르게 고르기 어렵습니다.

특히 다음 질문에 빨리 답하기 어렵습니다.

- 오늘 먼저 확인해야 할 공고는 무엇인가?
- 보호 종료가 임박한 공고는 어느 지역에 몰려 있는가?
- 공식 문의를 위해 어떤 보호소 정보가 필요한가?
- API 연결이나 데이터 export가 불안정할 때도 앱이 안전하게 동작하는가?

## Solution

Shelter Signal은 공고 목록을 단순 최신순이 아니라 “확인 우선순위가 있는 신호”로 다룹니다.

```text
Public API / mock data
→ PostgreSQL
→ SQL models
→ Rescue Window Score
→ static JSON export
→ PWA app
→ Vercel /api/shelters for notice-derived contact summaries
```

브라우저 앱은 PostgreSQL이나 공공 API에 직접 연결하지 않습니다. 로컬 export 스크립트가 SQL view 결과를 정적 JSON으로 만들고, PWA는 `/data/*.json` 파일을 우선 로딩합니다. JSON 로딩에 실패하면 앱 내부 mock 데이터로 fallback합니다.

보호소 조회는 프론트엔드에서 `/api/shelters`만 호출합니다. 이 Vercel Serverless Function이 `DATA_GO_KR_SERVICE_KEY`를 읽어 data.go.kr 구조동물 공고 API와 통신하고, 화면에는 공고에 포함된 보호소명, 주소, 연락처, 관할기관 필드만 정규화해서 전달합니다. 이 목록은 전체 공식 보호소 디렉터리가 아니라 공고 기반 연락 맥락입니다.

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
- **PWA assets**: manifest, SVG icon, OG image metadata

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
- Static JSON data loading from `app/public/data/*.json`
- Mock data fallback when exported JSON cannot load
- Rescue Window Score display and sorting
- Notice filters and display count control
- Region signal explorer
- Internal `/api/shelters` route for notice-derived shelter/contact summaries when `DATA_GO_KR_SERVICE_KEY` is configured
- Detail sheet with official notice and shelter contact fields
- Deployment-ready Vite app under `/app`

Not implemented:

- Live production backend
- User accounts or authentication
- Persisted saved notices
- Push, email, or SMS notifications
- n8n automation in the deployed app
- Shelter homepage, operating-hours, or coordinate enrichment

## Operational DB Plan

현재 구조: Shelter Signal은 아직 정적 JSON export 기반 PWA입니다. 프런트엔드는 `app/public/data/*.json`을 먼저 읽고, 파일 로딩에 실패하면 mock 데이터로 fallback합니다.

다음 구조: 다음 backend 단계에서는 operational PostgreSQL을 serverless API route 뒤에 둡니다. 새 `/api/notices` route는 병렬로 추가된 server-only 경로이며, 배포 환경의 `DATABASE_URL`을 읽어 PostgreSQL을 조회하되 DB secret을 browser code에 노출하지 않습니다.

스키마 가정: `/api/notices`는 현재 `sql/models/001_animals_clean.sql`에 정의된 notice-level SQL view인 `mart.animals_clean`을 조회합니다. 선택 필드는 기존 `animals.json` export shape와 최대한 맞춰, operational path가 성숙하는 동안 정적 PWA bridge가 안정적으로 유지되도록 합니다.

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
- 당분간 static JSON이 primary frontend data source로 유지됨

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

The route derives shelter-like summaries from notice fields already present in rescued-animal rows:

- `careNm`
- `careTel`
- `careAddr`
- `orgNm`

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

For local API-route testing through Vercel, configure a local secret outside git:

```text
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

Production shelter lookup requires the `DATA_GO_KR_SERVICE_KEY` environment variable in Vercel. Without it, the static PWA still renders, but selected-region shelter lookup shows a safe API error state. The deployed app does not require DB, auth, n8n, email, or SMS configuration.

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

## Portfolio Summary

**One-line summary**
공공데이터 구조동물 공고 API 기반 보호소 연락 맥락 PWA.

**Description**
Shelter Signal은 공공데이터 구조동물 공고 API를 Vercel 서버리스 함수로 호출하고, 공고 데이터에 포함된 보호소명, 전화번호, 주소, 관할기관 정보를 추출해 보호소 연락 맥락을 제공하는 구조동물 리스크 탐색 서비스입니다. 공고 목록과 지역 신호는 정적 JSON export를 우선 사용하고, 실패 시 mock 데이터로 안전하게 fallback합니다. 보호소 연락 목록은 notice-derived summary이며, 전체 공식 보호소 디렉터리로 주장하지 않습니다.

Shelter Signal is a rescued-animal risk exploration service that uses a Vercel serverless API route to call the data.go.kr rescued-animal notice API and derive shelter contact context from notice fields such as `careNm`, `careTel`, `careAddr`, and `orgNm`.

**Key highlights**

- 공공데이터 기반 구조동물 공고 탐색 경험 설계
- Rescue Window Score를 통한 우선 확인 흐름 제안
- PostgreSQL/SQL 모델링에서 PWA까지 이어지는 end-to-end 데이터 제품 MVP
- Vercel 내부 API route로 공공데이터 서비스 키를 숨기고 notice-derived 보호소 연락 맥락 제공
- 정적 JSON fallback과 live API route의 역할을 분리한 portfolio demo
- DB, auth, 알림 없이도 동작하는 V1 live shelter lookup 구성

## Next Steps

- 최신 UI 기준 화면 screenshot 갱신
- Signal Archive용 case study 작성
- 공공 API 권한과 응답 범위 재검토
- 별도 보호소 센터 API와 보호소 정보 enrichment 가능 여부 확인
- 저장 기능과 알림 흐름은 별도 단계에서 설계
- 정적 JSON 공고 데이터와 live API route 사이의 데이터 계약 검토
