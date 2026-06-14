# Shelter Signal Portfolio Case Study

## Project Summary

Shelter Signal은 구조동물 공고를 공고 생명주기와 데이터 신뢰 상태에 따라 다시 정리한 모바일 public-data PWA입니다.

- Production: https://shelter-signal-ebon.vercel.app/
- Primary production source: live public rescued-animal notice API
- Product boundary: portfolio prototype, not a production shelter service

## Problem

구조동물 원천 공고에는 현재 공고와 과거 기록이 섞일 수 있고, 종료 임박 공고가 긴 목록 안에 묻히기 쉽습니다. 또한 공공 API 장애나 빈 결과와 sample fallback을 같은 상태로 보여주면 사용자가 데이터 신뢰 수준을 판단하기 어렵습니다.

핵심 질문은 다음과 같습니다.

> 현재 확인 가능한 공고와 종료 임박 공고를 빠르게 찾고, 지금 보고 있는 데이터가 live인지 fallback인지 어떻게 분명하게 알릴 수 있는가?

## Current Operating Architecture

```text
React PWA
→ Vercel /api/notices
→ server-side normalized-data cache
→ data.go.kr rescued-animal notice API
→ KST freshness normalization
→ current / urgent / protected / archive views
→ server-side region filter and page/limit response
```

브라우저는 공공 API service key나 데이터베이스 credential을 받지 않습니다. `/api/notices`와 `/api/shelters`만 server-side 환경 변수를 읽습니다.

## What I Built

- KST 기준 최근 30일 live notice collection
- `noticeEdt` 기반 current/urgent/protected/archive 분리
- `days_left` 및 `D-Day`~`D-3` urgency classification
- 만료·마감일 누락 공고의 current/urgent 제외
- Korean region alias를 처리하는 server-side region filtering
- 기본 20건, 최대 100건의 page/limit pagination
- normalized live dataset 대상 5분 server-side cache
- concurrent request의 in-flight fetch 공유
- live/cache/fallback/empty state를 구분하는 API metadata와 UI
- fallback에서만 표시되는 명시적 경고
- notice-derived shelter contact context
- local PostgreSQL/SQL models와 static/mock fallback 검증 경로

## Key Decisions

### Live-first, fallback explicitly labeled

Production의 primary read path는 live public API입니다. Live API가 실패하거나 unusable response를 반환하고 사용할 수 있는 live cache도 없을 때만 PostgreSQL, static JSON, mock fallback을 사용합니다.

Fallback 데이터는 항상 `source: "fallback"`과 경고를 표시합니다. 정상적인 live empty result는 `source: "api"`를 유지합니다.

### Freshness is a server boundary

서버가 `noticeEdt`를 KST 날짜 기준으로 계산해 expired·missing deadline 행을 current/urgent에서 제외합니다. UI는 이미 분류된 view를 받아 표시하므로 만료 공고가 기본 목록에 섞이지 않습니다.

### Large live results are filtered before rendering

지역, view, page, limit를 server response layer에서 적용합니다. 지역 변경과 `공고 더 보기`는 새로운 server-filtered page를 요청하며, 전체 live dataset을 한 번에 브라우저로 보내지 않습니다.

### Cache is not fallback

Cache hit와 허용된 stale-live 응답은 usable live data에서 생성되었으므로 `source: "api"`입니다. Serverless instance cache는 cold start와 instance 간 공유를 보장하지 않는다는 한계를 함께 문서화합니다.

### Safe observability

응답과 structured log에는 cache 상태, duration, count, view, pagination 진단만 포함합니다. Service key, secret 환경 변수, secret-bearing upstream URL은 반환하거나 기록하지 않습니다.

## Verification Evidence

Production smoke testing checks:

- UI data status is `Live API`
- fallback warning is hidden for live/cache responses
- region selection and load-more request server-filtered pages
- `/api/notices` returns `source: "api"`
- `cacheStatus`, `dateRange`, count, pagination metadata are present
- `fallbackReason` is absent for live/cache responses
- expired or missing-deadline records do not leak into current/urgent

This smoke test verifies the operating boundary, not the completeness or accuracy of the entire upstream public dataset.

## Historical Architecture Context

An earlier V1.5 stage validated Docker PostgreSQL → Neon PostgreSQL → Vercel `/api/notices` as a primary operational read path. That path is no longer the current Production primary architecture.

PostgreSQL/Neon materials are retained only as:

- historical implementation evidence
- optional server-side fallback
- local SQL modeling and alert-candidate validation

See [neon-deployment.md](neon-deployment.md) for the archived plan.

## Technical Stack

- Vite, React, TypeScript
- Vercel Functions
- data.go.kr public API
- Python, PostgreSQL, SQL, Docker Compose
- Static JSON and mock fallback
- GitHub Actions

## Limitations

- Public API quota, permission, latency, and XML/plain-text errors can affect live collection.
- The upstream page cap can limit unusually large result windows.
- Source agencies can update notice and process state on different schedules.
- Vercel instance memory cache is not guaranteed across cold starts or instances.
- Notice-derived shelter summaries are not a complete official shelter directory.
- Rescue Window Score is an internal exploration signal, not an official score or outcome prediction.
- User accounts, persisted saves, real notifications, monitoring, and SLA are not implemented.

## Portfolio Value

Shelter Signal demonstrates how to turn unstable public-data rows into a reviewable product surface with explicit freshness, pagination, cache, fallback, secret, and verification boundaries. The project emphasizes data trust and operating-state communication rather than claiming public-service outcomes.
