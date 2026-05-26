# Shelter Signal Portfolio Summary

## Project Title

Shelter Signal

배포 링크: https://shelter-signal-ebon.vercel.app/

현재 배포된 앱은 export된 정적 JSON 데이터를 사용하는 포트폴리오 시연용 PWA이며, 반응형 제품 랜딩 페이지와 앱 미리보기 형태로 정리했습니다.

## Portfolio Card Copy

“보호 종료가 가까운 구조동물 공고를 먼저 확인하도록 돕는 공공데이터 기반 PWA”

## Screenshot References

- 랜딩 히어로: `docs/screenshots/01-landing-hero.png`
- 앱 preview 홈: `docs/screenshots/02-app-preview-home.png`
- 골든타임: `docs/screenshots/03-golden-time.png`
- 공고 필터: `docs/screenshots/04-notices-filter.png`
- 지역 탐색: `docs/screenshots/05-region-explorer.png`
- 상세 시트: `docs/screenshots/06-detail-sheet.png`
- 데이터 파이프라인: `docs/screenshots/07-data-pipeline.png`

## One-line Description

Shelter Signal은 구조동물 공고의 보호 종료일과 데이터 신호를 기반으로, 먼저 확인해야 할 공고를 정리하는 공공데이터 기반 PWA입니다.

## Problem

구조동물 공고는 종료일, 지역, 보호소 연락처, 사진 여부 같은 정보가 흩어져 있어 사용자가 긴급하게 확인해야 할 공고를 빠르게 고르기 어렵습니다.

## Solution

공공데이터 API 또는 mock 데이터를 PostgreSQL에 적재하고, SQL 모델에서 Rescue Window Score와 summary view를 만든 뒤, 정적 JSON export를 통해 PWA가 데이터를 읽도록 구성했습니다. 현재 화면 구성은 제품 랜딩 페이지 안에 앱 미리보기를 배치하고, 홈 신호, 골든타임 공고, 필터, 표시 수 조절, 지역 신호 탐색기, 상세 시트를 보여줍니다.

## Technical Stack

- Python
- PostgreSQL
- SQL migrations, models, tests
- Docker Compose
- Static JSON export
- Vite
- React
- TypeScript
- PWA metadata and SVG brand assets

## Key Contribution

데이터 파이프라인에서 사용자 화면까지 이어지는 전체 흐름을 직접 설계했습니다. 특히 공식 점수나 예측 모델이 아닌 내부 탐색 신호로 Rescue Window Score를 정의하고, 이를 앱의 우선순위 리스트와 지역 탐색 UX로 연결했습니다.

## Why This Project Matters

이 프로젝트는 공공데이터를 단순 조회 화면으로 끝내지 않고, 사용자가 “오늘 무엇을 먼저 확인해야 하는지” 판단할 수 있는 제품형 인터페이스로 바꾸는 실험입니다. 동시에 API 권한, 데이터 품질, fallback, 정적 export 같은 현실적인 제약을 드러낸 상태로 다룹니다.

## Limitations

- Production-ready 서비스가 아닙니다.
- 실사용자 계정과 저장 기능 persistence는 아직 없습니다.
- email, SMS, n8n 자동화는 아직 구현하지 않았습니다.
- 보호소 정보 API는 로컬 스모크 테스트에서 403이 발생해 enrichment를 다음 단계로 미뤘습니다.
- 현재 앱은 live backend 대신 static JSON export를 사용합니다.
- Rescue Window Score는 공식 위험 점수나 결과 예측 모델이 아니라 내부 우선순위 탐색 신호입니다.
