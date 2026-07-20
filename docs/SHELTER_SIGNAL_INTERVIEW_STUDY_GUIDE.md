# Shelter Signal 면접·학습 가이드

이 문서는 Shelter Signal 전체를 빠르게 복습하고, 데이터 분석·데이터 제품·공공데이터·분석 엔지니어링 면접에서 프로젝트를 일관되게 설명하기 위한 요약본입니다.

> 핵심 질문: **불안정한 공공데이터에서 지금 유효한 공고와 어제 이후의 변화를 어떻게 신뢰 가능한 제품 흐름으로 보여줄 것인가?**

---

## 1. 30초 프로젝트 소개

Shelter Signal은 구조동물 공고를 단순 목록으로 보여주는 대신, **현재 유효한 공고 탐색**과 **시간에 따른 변화 추적**으로 분리한 모바일 우선 공공데이터 제품입니다.

V1에서는 data.go.kr 구조동물 공고 API를 서버에서 조회해 현재·긴급·보호·아카이브 상태로 정규화하고, 캐시·fallback·빈 결과를 구분해 데이터 신뢰 상태를 함께 표시합니다.

V2에서는 매일 06:20 KST에 public-safe snapshot을 보존하고, 이전 성공 수집과 비교해 신규·마감 변경·상태 변경·미관측·복귀 이벤트를 생성합니다. 이를 오늘의 변화, 공고별 타임라인, D-Day~D-3 마감 브리핑으로 연결했습니다.

## 2. 1분 면접 답변

구조동물 공고 데이터는 현재 공고와 과거 기록이 섞일 수 있고, 종료 임박 공고가 긴 목록 안에 묻히며, API 장애·정상 0건·fallback을 같은 상태로 보여주면 사용자가 지금 보고 있는 데이터의 신뢰 수준을 알기 어렵습니다.

그래서 Shelter Signal을 두 계층으로 나눴습니다. V1은 “지금 어떤 공고가 유효한가”를 답합니다. 서버가 최근 공고를 수집하고 KST 기준으로 마감일을 계산해 current, urgent, protected, archive로 분류하며, 지역과 pagination도 서버에서 처리합니다. Live API, usable cache, fallback, 정상 empty state를 서로 다르게 표현했습니다.

V2는 “어제와 무엇이 달라졌고 오늘 무엇을 먼저 봐야 하는가”를 답합니다. 매일 snapshot을 저장한 뒤 이전 성공 수집과 비교해 7개 변화 이벤트를 만들고, 한 번의 미관측을 종료로 단정하지 않도록 두 날짜 확인 후 DISAPPEARED로 전환합니다. 결과는 오늘 변화 대시보드, 공고별 누적 타임라인, 설명 가능한 마감 브리핑으로 제공합니다.

이 프로젝트의 핵심은 예측 모델이 아니라 **freshness, 상태 전이, fallback 경계, 관측 한계와 비밀정보 경계를 제품에 명시한 것**입니다.

---

## 3. 문제 정의

### 사용자 문제

원천 구조동물 공고에는 다음 문제가 있습니다.

- 이미 종료된 공고와 현재 공고가 섞일 수 있습니다.
- D-Day~D-3 공고가 긴 목록 안에 묻힐 수 있습니다.
- 같은 공고의 마감일과 처리 상태가 바뀌어도 변화가 보존되지 않습니다.
- API 장애, 캐시 응답, fallback, 정상 0건을 구분하지 않으면 데이터 신뢰 수준을 알기 어렵습니다.
- 한 번 조회되지 않은 공고를 곧바로 종료나 특정 결과로 해석하면 잘못된 결론을 만들 수 있습니다.

### 제품 질문

```text
V1: 지금 어떤 공고가 유효한가?
V2: 어제와 무엇이 달라졌고 오늘 무엇을 먼저 확인해야 하는가?
```

### 해결 방식

1. 공공 API를 server-side에서 수집합니다.
2. 날짜와 상태를 KST 기준으로 정규화합니다.
3. current / urgent / protected / archive view로 분리합니다.
4. source, cache, pagination, count, warning metadata를 함께 제공합니다.
5. 매일 public-safe snapshot을 보존합니다.
6. 이전 성공 snapshot과 비교해 변화 이벤트를 생성합니다.
7. 이벤트를 공고별 누적 타임라인으로 만듭니다.
8. D-Day~D-3와 당일 변화 근거를 결합해 확인 순서를 제공합니다.

---

## 4. V1과 V2의 역할

| 구분 | 핵심 질문 | 주요 산출물 |
| --- | --- | --- |
| V1 · Live-first | 지금 유효한 공고는 무엇인가? | 현재·긴급·보호·아카이브 목록, 지역 필터, pagination, source 상태 |
| V2 · History-aware | 무엇이 바뀌었고 무엇을 먼저 봐야 하는가? | 일별 변화 이벤트, 공고 타임라인, 마감 브리핑, 수집 상태 |

V2는 V1을 대체하지 않습니다. 현재 조회 계층 위에 **보존·비교·판단 계층**을 추가합니다.

---

## 5. 전체 아키텍처

```text
V1 live path
React PWA
→ Vercel /api/notices
→ normalized-data cache
→ data.go.kr 구조동물 공고 API
→ KST freshness normalization
→ current / urgent / protected / archive
→ region / page / limit response

V2 history path
GitHub Actions · 매일 06:20 KST
→ public API snapshot
→ latest + monthly public-safe JSON
→ previous successful snapshot comparison
→ daily change events + missing state
→ per-notice cumulative timeline
→ today-change dashboard + deadline briefing
```

### 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프런트엔드 | Vite, React, TypeScript, PWA |
| 서버 경계 | Vercel Functions |
| 원천 | data.go.kr 구조동물 공고 API |
| 보존·이벤트 | Node.js scripts, GitHub Actions, JSON artifacts |
| 보조 검증 | Python, PostgreSQL, SQL, Docker Compose |
| 배포·검증 | Vercel, GitHub Actions, lint, typecheck, build, smoke test |

---

## 6. V1 데이터 흐름

### 기본 조회 범위

- KST 오늘 기준 최근 30일 공고를 조회합니다.
- `noticeEdt`를 공개 공고 종료일로 사용합니다.
- `days_left`와 `deadline_status`를 계산합니다.

```text
D-Day | D-1 | D-2 | D-3 | active | expired
```

### View 정의

- `current`: 종료되지 않았고 종료일이 유효한 공고
- `urgent`: `days_left`가 0~3인 공고
- `protected`: current 중 처리 상태가 보호인 공고
- `archive`: 만료 또는 종료 상태를 명시적으로 조회한 공고

마감일이 없거나 이미 만료된 행은 current와 urgent에서 제외합니다.

### 서버에서 필터링하는 이유

지역, view, page, limit를 서버 응답 계층에서 적용합니다.

- 전체 live dataset을 브라우저로 한꺼번에 보내지 않습니다.
- 지역 변경과 더 보기는 새 server-filtered page를 요청합니다.
- 비밀키와 upstream URL이 frontend bundle에 노출되지 않습니다.
- 데이터 상태와 pagination metadata를 API 계약으로 유지할 수 있습니다.

---

## 7. Cache와 Fallback 설계

### Cache는 fallback이 아닙니다

정규화된 live dataset은 기본 300초 동안 server-side instance memory에 캐시합니다. Cache hit와 허용된 stale-live 응답은 과거의 정상 live 응답에서 만들어졌으므로 `source: api`를 유지합니다.

### Fallback 조건

다음 조건에서만 fallback을 사용합니다.

```text
live API unusable
AND usable live cache 없음
→ PostgreSQL
→ static JSON
→ mock
```

Fallback은 항상 `source: fallback`과 경고를 표시합니다.

### 정상 0건 처리

Live API가 정상적으로 0건을 반환한 경우는 장애가 아닙니다. `source: api`인 empty state로 유지합니다.

### 주요 metadata

```text
source
fetchedAt
dateRange
pagesFetched
upstreamTotalCount
normalizedItemCount
returnedCount
totalFilteredCount
hasMore
nextPage
cacheStatus
cacheAgeSeconds
upstreamFetchDurationMs
fallbackReason
warnings
```

이 metadata는 사용자가 단순 결과뿐 아니라 **현재 데이터가 어떤 경로로 만들어졌는지** 판단하게 합니다.

---

## 8. V2 snapshot 보존

### 실행 방식

- Scheduled: 매일 `21:20 UTC`, 다음 날 `06:20 KST`
- Manual recovery: `workflow_dispatch`
- dry-run: 외부 쓰기 없이 경로와 로직 검증

### 생성 파일

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

매일 월 전체를 새 파일로 복제하지 않고, latest와 monthly snapshot을 갱신하며 날짜별 변화 이벤트와 누적 타임라인을 별도로 보존합니다.

---

## 9. 변화 이벤트 모델

### Stable key

```text
desertion_no
→ 없으면 notice_no fallback
```

### 이벤트 7종

| 이벤트 | 의미 |
| --- | --- |
| `NEW` | 이전 성공 수집에는 없고 현재 수집에서 처음 관측 |
| `DEADLINE_CHANGED` | 공고 종료일 변경 |
| `STATUS_CHANGED` | 처리 상태 변경 |
| `BECAME_URGENT` | D-3 이내 구간에 진입 |
| `NOT_OBSERVED` | 동일 관측 창에서 한 번 미관측 |
| `DISAPPEARED` | 서로 다른 날짜에 두 번 이상 미관측 |
| `RETURNED` | 미관측 상태였던 공고가 다시 관측 |

### 왜 한 번의 미관측을 DISAPPEARED로 보지 않았는가

공공 API는 페이지·조회창·원천 업데이트 문제로 특정 행이 일시적으로 빠질 수 있습니다. 한 번의 누락을 종료로 단정하면 거짓 변화 이벤트가 만들어집니다.

따라서 첫 누락은 `NOT_OBSERVED`, 서로 다른 날짜의 반복 누락 후에만 `DISAPPEARED`로 승격합니다.

### 추가 안정성 규칙

- 같은 날 recovery run의 이벤트를 병합합니다.
- `eventId`로 타임라인 중복을 제거합니다.
- 월 조회창 변경으로 대량 가짜 미관측이 생기지 않도록 reset 경계를 둡니다.
- `DISAPPEARED`는 관측 상태일 뿐 입양·이송·안락사 등 최종 결과를 의미하지 않습니다.

---

## 10. 제품 화면

### Today-change dashboard

- 신규, 마감 변경, 상태 변경, 미관측 요약
- 이전·현재 관측 건수와 증감
- 수집 페이지, 원천 건수, truncation, warnings
- 변화 유형별 필터

### Per-notice timeline

- 최초·최근 변화 관측 시각
- 누적 이벤트와 유형별 횟수
- 종료일·상태·남은 날짜의 이전 값과 현재 값
- URL hash 직접 진입

타임라인은 V2 이벤트 보존을 시작한 이후의 관측만 포함합니다.

### Deadline briefing

- D-Day~D-3 현재 공고
- 오늘 신규 긴급, 긴급 구간 진입, 종료일 앞당김 근거
- 지역·마감일 필터
- 포함 이유가 설명되는 우선순위 상위 항목

이 순위는 공식 위험 점수, 안락사 가능성, 입양 예측이 아닙니다.

---

## 11. 핵심 설계 선택과 이유

### 11.1 Live-first를 유지한 이유

현재 공고 탐색은 최신성이 가장 중요합니다. DB snapshot을 기본 조회 경로로 두면 수집 주기 사이의 변경을 놓칠 수 있어 production primary path는 live API로 유지했습니다.

### 11.2 History path를 별도로 둔 이유

현재 상태와 과거 관측은 데이터 성격이 다릅니다. Live API 응답을 직접 수정하지 않고 별도 snapshot·event layer로 분리해야 현재성과 이력 보존을 동시에 설명할 수 있습니다.

### 11.3 Freshness를 서버 경계에서 계산한 이유

클라이언트마다 날짜 계산이 달라지거나 만료 공고가 섞이는 것을 방지합니다. UI는 이미 정규화된 상태를 받습니다.

### 11.4 Source 상태를 제품에 노출한 이유

공공데이터 제품에서 결과 수치만큼 중요한 것은 **그 결과가 live인지, cache인지, fallback인지**입니다. 사용자가 신뢰 수준을 판단할 수 있도록 운영 상태를 화면에 포함했습니다.

### 11.5 예측 모델을 만들지 않은 이유

입양·안락사 같은 최종 outcome label과 관측 완전성이 검증되지 않았습니다. 검증되지 않은 예측보다 관측 사실과 마감 근거를 설명하는 흐름이 적절했습니다.

---

## 12. 검증 전략

### Repository checks

```bash
npm run snapshot:check
npm run snapshot:test
npm run snapshot:dry-run
cd app
npm ci
npm run lint
npm run typecheck
npm run build
```

### 확인하는 내용

- snapshot scripts 문법과 self-test
- dry-run 경로
- live/cache/fallback/empty 상태 분리
- current/urgent에 만료·마감일 누락 공고가 섞이지 않는지
- 지역 필터와 pagination
- 변화 이벤트와 타임라인 중복 제거
- public-safe artifact와 secret 경계
- production source·cache·count metadata

검증은 전체 upstream 데이터의 완전성이나 정확성을 보장하지 않습니다. **제품이 선언한 운영 경계가 지켜지는지**를 확인합니다.

---

## 13. 반드시 말해야 하는 한계

- 공공 API quota, latency, permission, XML·plain-text 오류의 영향을 받습니다.
- 원천 페이지 cap과 조회창 때문에 전체 이력이 완전하다고 주장할 수 없습니다.
- 기관별 상태 업데이트 시점이 다를 수 있습니다.
- Vercel instance memory cache는 cold start와 instance 간 공유가 보장되지 않습니다.
- 공고에서 추출한 보호소 정보는 완전한 공식 보호소 디렉터리가 아닙니다.
- V2 타임라인은 이벤트 보존 시작 이후만 포함합니다.
- `DISAPPEARED`는 최종 동물 결과가 아니라 수집기 관측 상태입니다.
- 외부 이메일·문자·푸시 발송, 사용자 계정, 구독, 운영 SLA는 구현하지 않았습니다.
- 마감 브리핑은 공식 위험 점수나 결과 예측이 아닙니다.

---

## 14. 개선한다면

### 데이터 신뢰성

- shared cache 또는 durable cache를 도입해 instance 간 일관성을 높입니다.
- 수집 성공률·지연·truncation을 기간별로 모니터링합니다.
- 원천 응답 스키마 변경 감지와 contract test를 강화합니다.

### 이력 모델

- 공고별 상태 전이 규칙을 더 명시적인 state machine으로 관리합니다.
- 관측 누락 원인을 조회창 변경·API 실패·실제 미관측으로 분리합니다.
- 수집 coverage를 날짜·기관별로 시각화합니다.

### 제품

- 사용자 동의를 전제로 저장 공고와 구독 설계를 검토합니다.
- 알림을 추가한다면 실제 발송보다 opt-in, 해지, 중복 방지, 실패 재처리, 개인정보 경계를 먼저 설계합니다.

---

## 15. 예상 면접 질문과 답변 핵심

### Q1. 이 프로젝트의 가장 중요한 문제 정의는 무엇인가요?

현재 공고 목록 제공만이 아니라, **데이터가 얼마나 최신이고 어떤 경로에서 왔으며 무엇이 변했는지를 함께 보여주는 것**입니다.

### Q2. Cache와 fallback을 왜 구분했나요?

Cache는 과거 정상 live 응답이고 fallback은 live 경로를 사용할 수 없을 때의 대체 데이터입니다. 둘을 같은 상태로 표시하면 데이터 신뢰 수준을 잘못 전달합니다.

### Q3. 정상 0건도 fallback으로 바꾸면 안 되는 이유는 무엇인가요?

0건은 유효한 비즈니스 결과일 수 있습니다. 이를 장애로 간주하면 실제 empty state를 가짜 데이터로 덮게 됩니다.

### Q4. 날짜 처리를 왜 KST 서버 기준으로 했나요?

공고 종료일과 D-Day 판단을 단일 기준으로 유지하고 클라이언트별 시간대 차이와 만료 공고 혼입을 방지하기 위해서입니다.

### Q5. 한 번 누락된 공고를 바로 종료로 처리하지 않은 이유는 무엇인가요?

공공 API의 일시적 누락 가능성이 있기 때문입니다. 첫 누락은 관측 불확실성으로 두고 반복 누락 후 상태를 강화했습니다.

### Q6. Snapshot을 매일 보존하면서 왜 월 전체 파일을 매번 추가하지 않았나요?

저장 중복을 줄이고, latest·monthly 상태와 날짜별 이벤트·누적 타임라인의 역할을 분리하기 위해서입니다.

### Q7. 왜 데이터베이스가 현재 primary read path가 아닌가요?

현재 공고 탐색에서는 최신성이 중요해 live API가 우선입니다. PostgreSQL은 역사적 구현 증거와 fallback·SQL 검증 경로로 남겼습니다.

### Q8. 이 프로젝트에서 분석가 역량은 어디에 있나요?

단순 API 연동보다 날짜·상태 정의, 신뢰 상태 분리, 변화 이벤트 모델, 우선순위 근거, 관측 한계와 검증 경계를 설계한 부분입니다.

### Q9. 마감 브리핑은 위험 점수인가요?

아닙니다. D-Day~D-3와 당일 변화 근거를 조합한 설명 가능한 확인 순서입니다.

### Q10. 가장 큰 한계는 무엇인가요?

수집기가 관측한 이력만 보존하므로 upstream의 완전한 생명주기나 최종 동물 결과를 알 수 없다는 점입니다.

### Q11. Production 서비스라고 할 수 있나요?

실제 Vercel 배포와 자동 수집은 있지만, 사용자 계정·외부 알림·운영 SLA가 없는 포트폴리오 데이터 제품입니다.

### Q12. 다시 만든다면 무엇을 먼저 개선하겠나요?

관측 coverage와 수집 품질을 기간별로 측정하고, missing state를 더 명시적인 state machine으로 정리하겠습니다.

---

## 16. 핵심 파일 읽는 순서

### 1단계 · 제품과 전체 구조

1. `README.md`
2. `docs/portfolio-case-study.md`
3. `docs/v2-roadmap.md`

### 2단계 · V2 수집과 이벤트

1. `scripts/fetch-monthly-notices.mjs`
2. `scripts/run-snapshot-with-events.mjs`
3. `scripts/update-notice-timelines.mjs`
4. `docs/change-event-schema.md`

### 3단계 · API와 프런트

1. `app/api/notices.*` 또는 현재 notices API 진입 파일
2. 공고 정규화·날짜 계산 유틸리티
3. 변화 대시보드·타임라인·브리핑 컴포넌트

### 4단계 · 검증

1. `VERIFY.md`
2. `.github/workflows/monthly-notice-snapshot.yml`
3. `.github/workflows/verify.yml`
4. `docs/evidence/v2-production-verification-2026-07-14.md`

---

## 17. 3회독 학습법

### 1회독 · 제품 질문만 익히기

다음 문장을 설명할 수 있으면 됩니다.

> V1은 현재 유효 공고를 신뢰 상태와 함께 보여주고, V2는 매일 관측을 보존해 변화와 마감 우선순위를 설명한다.

### 2회독 · 데이터 상태 흐름 보기

```text
live → cache → fallback
current → urgent / protected / archive
snapshot → event → timeline → briefing
```

각 상태가 어떤 조건으로 바뀌는지만 따라갑니다.

### 3회독 · 설계 이유와 한계 말하기

- 왜 server-side freshness인가?
- 왜 cache와 fallback을 구분하는가?
- 왜 한 번의 미관측을 종료로 보지 않는가?
- 왜 예측 모델을 만들지 않았는가?
- 무엇을 production이라고 주장하지 않는가?

---

## 18. 면접 직전 체크리스트

- [ ] 30초 소개를 외우지 않고 자연스럽게 설명할 수 있다.
- [ ] V1과 V2의 질문 차이를 말할 수 있다.
- [ ] current / urgent / protected / archive 기준을 설명할 수 있다.
- [ ] cache와 fallback의 차이를 설명할 수 있다.
- [ ] 7개 변화 이벤트 중 핵심 4개 이상을 말할 수 있다.
- [ ] NOT_OBSERVED와 DISAPPEARED를 분리한 이유를 말할 수 있다.
- [ ] GitHub Actions snapshot 흐름을 설명할 수 있다.
- [ ] 데이터가 live인지 판단하는 metadata를 말할 수 있다.
- [ ] 마감 브리핑이 예측 점수가 아님을 명확히 할 수 있다.
- [ ] 타임라인과 공공데이터 완전성의 한계를 말할 수 있다.

---

## 19. 최종 안전 문장

> Shelter Signal은 구조동물 공고를 live-first 현재 탐색과 history-aware 변화 추적으로 분리한 공공데이터 제품입니다. 서버에서 날짜·상태·지역·pagination을 정규화하고, cache와 fallback을 명시적으로 구분했으며, 매일 snapshot을 비교해 변화 이벤트와 공고별 타임라인, 마감 브리핑을 생성했습니다. 결과는 수집기가 관측한 변화와 확인 순서를 설명할 뿐, 공식 위험 점수나 동물의 최종 결과를 예측하지 않습니다.
