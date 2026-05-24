# Shelter Signal

Shelter Signal은 구조동물 공고의 보호 종료일과 데이터 신호를 기반으로, 먼저 확인해야 할 공고를 정리하는 공공데이터 기반 PWA입니다.

이 저장소는 공공데이터 API 점검, PostgreSQL 적재, SQL 모델링, 정적 JSON export, React PWA 화면까지 이어지는 데이터 제품형 MVP입니다. 운영 서비스로 완성된 상태는 아니며, 포트폴리오와 다음 단계 구현을 위한 검증 가능한 기반을 목표로 합니다.

## 프로젝트 개요

Shelter Signal은 구조동물 공고를 단순히 나열하는 대신, 보호 종료일이 가까운 공고를 먼저 살펴볼 수 있도록 정리합니다.

현재 구현된 범위는 다음과 같습니다.

- 구조동물 공공 API 스모크 테스트
- PostgreSQL 기반 로컬 데이터 파이프라인
- `raw.rescued_animals` 원천 테이블
- mock 데이터 기반 파이프라인 검증
- SQL clean 모델과 summary view
- Rescue Window Score 계산
- 앱용 정적 JSON export bridge
- Vite + React + TypeScript PWA
- exported JSON 우선 로딩, mock 데이터 fallback
- 모바일 우선 UI
- 브랜드, 아이콘, OG 이미지, PWA 메타데이터
- 공고 표시 수 조절
- 지역 신호 탐색기
- 상세 시트 연락처 액션

## 문제 정의

구조동물 공고는 공고 종료일, 보호소 연락처, 지역, 사진 여부 같은 정보가 흩어져 있어 사용자가 우선 확인할 공고를 빠르게 고르기 어렵습니다.

특히 보호 종료가 가까운 공고를 놓치지 않으려면 다음 질문에 빨리 답할 수 있어야 합니다.

- 오늘 먼저 확인해야 할 공고는 무엇인가?
- 보호 종료가 임박한 공고는 어느 지역에 몰려 있는가?
- 공식 문의를 위해 어떤 보호소 정보가 필요한가?
- 데이터가 없거나 API 연결이 불안정할 때도 앱이 안전하게 동작하는가?

Shelter Signal은 이 흐름을 데이터 파이프라인과 PWA 화면으로 나누어 검증합니다.

## 핵심 아이디어

핵심 아이디어는 공고 목록을 “최신순 목록”이 아니라 “확인 우선순위가 있는 신호”로 보는 것입니다.

데이터 흐름은 다음과 같습니다.

```text
Public API / mock data
→ PostgreSQL
→ SQL models
→ Rescue Window Score
→ static JSON export
→ PWA app
```

브라우저 앱은 PostgreSQL이나 공공 API에 직접 연결하지 않습니다. 로컬 export 스크립트가 SQL view 결과를 정적 JSON으로 만들고, PWA는 해당 JSON을 읽습니다. JSON 로딩이 실패하면 앱 내부 mock 데이터로 fallback합니다.

## 주요 기능

- **Home daily signal**: 오늘 먼저 확인할 보호 종료 신호와 우선 공고 요약
- **Golden Time list**: `긴급 확인`, `곧 종료` 공고 중심 리스트
- **Notice filters**: Rescue Window 라벨, 축종, 지역 필터
- **Notice display count control**: 필터 결과 중 `5개`, `10개`, `20개`, `전체` 표시 선택
- **Region signal explorer**: 수도권, 강원, 충청, 전라, 경상, 제주 권역과 개별 지역 신호 탐색
- **Detail sheet**: 공식 공고 정보, 동물 정보, 보호소 및 연락처 그룹화
- **Contact actions**: 전화번호 보기, 주소 확인, 공식 문의 안내
- **Saved notices placeholder**: 추후 저장 및 알림 기능을 위한 화면 자리
- **PWA metadata and brand assets**: manifest, icon, OG image, 앱 메타데이터

## 데이터 파이프라인

데이터 파이프라인은 로컬 PostgreSQL과 SQL 파일 중심으로 구성되어 있습니다.

주요 구성 요소는 다음과 같습니다.

- `docker-compose.yml`: 로컬 PostgreSQL 실행
- `sql/migrations/001_create_raw_rescued_animals.sql`: 원천 테이블 생성
- `ingestion/run_animal_ingestion.py`: 구조동물 공고 API 응답을 DB 필드로 정규화
- `data/sample/rescued_animals_mock.json`: 파이프라인 검증용 mock 데이터
- `scripts/validate_pipeline.py`: migration, mock 적재, SQL 모델, SQL 테스트, view 미리보기 검증
- `scripts/export_app_data.py`: mart view 결과를 앱용 JSON으로 export

중복 적재는 `source + desertion_no` 기준 upsert 구조로 막습니다. 기본 ingestion 동작은 dry-run이며, DB write는 명시적으로 요청한 경우에만 수행합니다.

생성되는 앱 데이터는 다음 위치에 저장됩니다.

```text
app/public/data/animals.json
app/public/data/region_summary.json
app/public/data/rescue_window_summary.json
app/public/data/shelter_summary.json
app/public/data/kind_summary.json
```

이 파일들은 현재 저장소에 포함된 정적 export 데이터이며, Vercel 배포 시 `/data/*.json` 정적 자산으로 함께 제공됩니다. 배포된 앱은 이 JSON을 먼저 읽고, 로딩에 실패하면 앱 내부 mock 데이터로 fallback합니다.

## Rescue Window Score

Rescue Window Score는 Shelter Signal 내부에서 공고 탐색 순서를 돕기 위한 우선순위 신호입니다.

현재 모델은 다음 데이터를 함께 봅니다.

- 공고 종료일까지 남은 일수
- 공고 진행 상태
- 사진 유무
- 보호소 전화번호 유무
- 특이사항 존재 여부

앱 라벨은 다음 중 하나로 표현됩니다.

- `긴급 확인`
- `곧 종료`
- `확인 필요`
- `여유 있음`
- `종료/확인 필요`

중요한 점은 이 점수가 공식 위험 점수가 아니라는 것입니다. Rescue Window Score는 입양 가능성이나 실제 결과를 예측하지 않으며, 공고를 살펴보는 순서를 정리하기 위한 내부 탐색 신호입니다. 공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해야 합니다.

## 앱 화면 구성

앱은 모바일 우선 PWA로 구성되어 있으며, 주요 탭은 `홈`, `골든타임`, `공고`, `지역`, `저장`입니다.

- `홈`: 오늘의 보호 종료 신호, 우선 확인 공고, 지역 신호 요약
- `골든타임`: 보호 종료가 가까운 공고 중심 리스트
- `공고`: 전체 공고 탐색, 필터, 표시 수 조절
- `지역`: 권역별/지역별 신호 탐색기와 지역 summary 카드
- `저장`: 관심 공고 저장 및 알림 준비 상태를 위한 placeholder
- `상세 시트`: 공식 공고 정보, 동물 정보, 보호소 및 연락처, 공식 문의 안내

## 보호소 정보 API 메모

보호소 정보 API는 별도 스모크 테스트를 추가했습니다.

현재 로컬 요청에서는 보호소 정보 API가 `403`으로 응답했습니다. 따라서 보호소 enrichment는 현재 구현 범위에 포함하지 않고 다음 단계로 미룹니다.

현재 앱은 구조동물 공고 데이터에 포함된 다음 필드를 사용합니다.

- `careNm`
- `careTel`
- `careAddr`
- `orgNm`

홈페이지 URL, 운영 시간, 좌표 같은 보호소 확장 정보는 실제 API 응답과 권한이 확인되기 전까지 지원한다고 가정하지 않습니다.

## 기술 스택

- **Data**: Python, PostgreSQL, SQL
- **Pipeline**: Docker Compose, ingestion script, validation script
- **Modeling**: SQL migrations, SQL models, SQL tests
- **Export bridge**: Python static JSON export
- **Frontend**: Vite, React, TypeScript
- **PWA**: Web manifest, SVG icon, OG image metadata
- **Validation**: mock data pipeline validation, TypeScript validation, Vite build, browser smoke tests

## 로컬 실행 방법

실제 API 키는 로컬 `.env` 파일에만 둡니다. `.env`는 Git에 커밋하지 않습니다.

```text
ANIMAL_API_KEY=발급받은_실제_키
```

저장소에는 예시 파일인 `.env.example`만 포함합니다. 스크립트는 API 키를 출력하지 않으며, README나 코드에도 실제 키를 넣지 않습니다.

### Data pipeline

```powershell
docker compose up -d
python scripts/validate_pipeline.py
python scripts/export_app_data.py
```

### App

```powershell
cd app
npm install
npm run dev
npm run build
```

현재 Codex 로컬 셸에서는 `npm`이 PATH에 없어, 동일한 빌드 검증을 아래 로컬 바이너리로 수행했습니다.

```powershell
cd app
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
```

## Vercel 배포 메모

Shelter Signal 앱은 저장소 루트가 아니라 `/app` 폴더에 있는 Vite PWA입니다. Vercel에서 프로젝트를 연결할 때 다음 설정을 사용합니다.

```text
Root Directory: app
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

배포 시 별도의 backend, DB 연결, API key, n8n, email/SMS, auth 설정은 필요하지 않습니다. 현재 앱은 `app/public/data/*.json` 정적 export 데이터를 사용하며, 운영용 실시간 API 서버가 붙은 production-ready 서비스는 아닙니다.

## 검증 방법

현재까지 확인한 검증 흐름은 다음과 같습니다.

- SQL pipeline validation passed
- exported JSON generation passed
- TypeScript/build validation passed
- browser smoke tests passed on mobile/tablet/desktop

브라우저 스모크 테스트에서 확인한 항목은 다음과 같습니다.

- 홈 렌더링
- navigation 동작
- Golden Time cards 렌더링
- 공고 필터 동작
- 공고 표시 수 조절 동작
- detail sheet 열기
- region selector 동작
- 선택/필터된 지역 summary 렌더링
- saved placeholder 렌더링
- exported JSON 우선 로딩
- mock fallback 유지
- console error 없음

Markdown 전용 formatter나 markdownlint 설정은 현재 저장소에 포함되어 있지 않습니다. 문서 변경 후 `git diff --check`로 공백과 diff 형식을 확인합니다.

## 주요 경로

```text
app/
app/src/data/mockAnimals.ts
app/public/data/
app/public/logo.svg
app/public/icon.svg
app/public/og-image.svg
ingestion/run_animal_ingestion.py
scripts/test_animal_api.py
scripts/test_shelter_api.py
scripts/export_app_data.py
scripts/validate_pipeline.py
sql/migrations/001_create_raw_rescued_animals.sql
sql/models/
sql/tests/
data/sample/rescued_animals_mock.json
data/raw/
docs/
docs/portfolio-summary.md
docs/screenshots/
docs/screenshots/README.md
```

`data/raw`의 실제 API 응답 샘플은 현재 Git에서 무시합니다. 로컬 점검용 원본 파일을 실수로 커밋하지 않기 위한 설정입니다.

## 현재 한계

Shelter Signal은 아직 production-ready 서비스가 아닙니다.

현재 한계는 다음과 같습니다.

- 운영용 backend API 없음
- 실제 사용자 계정 없음
- 실제 saved notices persistence 없음
- email/SMS 알림 없음
- n8n 자동화 없음
- 보호소 정보 enrichment는 API 권한 문제로 보류
- live backend 대신 static JSON export 사용
- Rescue Window Score는 내부 탐색 신호이며 공식 점수나 예측 모델이 아님

## 다음 단계

다음 단계는 포트폴리오 공개와 운영형 데이터 흐름을 분리해 진행합니다.

- Vercel deployment
- 앱 화면 screenshot capture
- portfolio case study 작성
- n8n scheduled ingestion
- email summary notification
- SMS notification as later phase
- 보호소 정보 API 권한 확인 후 enrichment 재검토
- static JSON bridge 이후의 backend/API 계약 설계
