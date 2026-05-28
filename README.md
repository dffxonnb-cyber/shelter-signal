# Shelter Signal

Shelter Signal은 **공공데이터 기반 유기동물 보호소 정보 탐색 PWA**입니다. 구조동물 공고를 모바일에서 빠르게 훑고, 보호 종료가 가까운 공고와 지역별 신호를 먼저 확인할 수 있도록 정리합니다.

배포 링크: https://shelter-signal-ebon.vercel.app/

현재 앱은 `app/public/data/*.json`으로 export된 정적 JSON 데이터를 사용합니다. 운영용 실시간 backend, 사용자 계정, 실제 저장 기능, email/SMS 알림, n8n 자동화가 붙은 production-ready 서비스는 아닙니다.

## Overview

Shelter Signal은 보호소 정보의 접근성을 높이기 위한 모바일 중심 서비스 실험입니다. 공공데이터와 로컬 데이터 파이프라인을 기반으로 구조동물 공고를 정리하고, React PWA 화면에서 탐색 가능한 형태로 제공합니다.

저장소는 데이터 수집 점검, PostgreSQL 적재, SQL 모델링, 정적 JSON export, Vite React 앱까지 이어지는 데이터 제품형 MVP를 목표로 합니다.

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
```

브라우저 앱은 PostgreSQL이나 공공 API에 직접 연결하지 않습니다. 로컬 export 스크립트가 SQL view 결과를 정적 JSON으로 만들고, PWA는 `/data/*.json` 파일을 우선 로딩합니다. JSON 로딩에 실패하면 앱 내부 mock 데이터로 fallback합니다.

## Features

- **Home signal**: 프로젝트 정체성, 정적 데이터 상태, 우선 확인 공고 요약
- **Golden Time list**: `긴급 확인`, `곧 종료` 공고 중심 리스트
- **Notice filters**: Rescue Window 라벨, 축종, 지역 필터
- **Notice display control**: 필터 결과 중 `5개`, `10개`, `20개`, `전체` 표시 선택
- **Region explorer**: 권역 및 개별 지역별 공고 신호 탐색
- **Detail sheet**: 공식 공고 정보, 동물 정보, 보호소 및 연락처 그룹화
- **Contact actions**: 전화번호 보기, 주소 확인, 공식 문의 안내
- **Saved placeholder**: 추후 저장 및 알림 기능을 위한 자리
- **PWA assets**: manifest, SVG icon, OG image metadata

## Tech Stack

- **Frontend**: Vite, React, TypeScript
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
- Detail sheet with official notice and shelter contact fields
- Deployment-ready Vite app under `/app`

Not implemented:

- Live production backend
- User accounts or authentication
- Persisted saved notices
- Push, email, or SMS notifications
- n8n automation in the deployed app
- Shelter homepage, operating-hours, or coordinate enrichment

## V2 n8n Manual Test Status

The `v2/n8n-email-alerts` branch has a validated local n8n HTTP dry-run path. The bridge exposes `POST /dry-run`, and `POST /dry-run?include_html=true` can return the generated digest preview as `email_html` for n8n to use in a later manual Email Send node.

The next V2 manual step is a one-recipient test email from local n8n using the `email_html` field and Mailpit local email capture. Mailpit lets the email render at `http://localhost:8025` without sending real external email. Gmail OAuth, Google Cloud setup, Gmail SMTP, and production email sending are intentionally deferred.

Real automated sending is not enabled: there are no committed credentials, no real recipients, no schedule trigger, no SMS, no auth, and no subscription flow.

See:

- `docs/n8n/daily-email-digest-workflow.md`
- `docs/n8n/local-dry-run-setup.md`
- `docs/n8n/manual-test-email.workflow.json`

## API/Data Notes

The app currently uses public rescue animal notice fields that are already present in the notice data, including:

- `careNm`
- `careTel`
- `careAddr`
- `orgNm`

The public shelter information API is still being evaluated. A local smoke test for shelter information returned `403`, so shelter enrichment is not treated as implemented.

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

The deployed app uses static JSON assets and does not require backend, DB, auth, API key, n8n, email, or SMS configuration.

## Portfolio Summary

**One-line summary**
공공데이터 기반 유기동물 보호소 정보 탐색 PWA.

**Description**
Shelter Signal은 구조동물 공고를 보호 종료일과 데이터 신호 중심으로 정리해, 모바일에서 먼저 확인해야 할 공고와 지역별 흐름을 빠르게 살펴볼 수 있게 만든 PWA입니다. 로컬 데이터 파이프라인에서 정적 JSON을 export하고, React 앱은 해당 데이터를 우선 로딩하되 실패 시 mock 데이터로 안전하게 fallback합니다.

**Key highlights**

- 공공데이터 기반 구조동물 공고 탐색 경험 설계
- Rescue Window Score를 통한 우선 확인 흐름 제안
- PostgreSQL/SQL 모델링에서 PWA까지 이어지는 end-to-end 데이터 제품 MVP
- 운영 API 한계를 명확히 분리한 정적 JSON 기반 portfolio demo

## Next Steps

- 최신 UI 기준 화면 screenshot 갱신
- Signal Archive용 case study 작성
- 공공 API 권한과 응답 범위 재검토
- 보호소 정보 enrichment 가능 여부 확인
- 저장 기능과 알림 흐름은 별도 단계에서 설계
- static JSON bridge 이후의 backend/API 계약 검토
