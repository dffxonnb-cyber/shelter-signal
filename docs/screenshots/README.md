# Shelter Signal Screenshots

이 폴더는 포트폴리오와 배포 문서에 사용할 앱 화면 캡처를 보관하기 위한 자리입니다.

현재 대표 캡처 환경은 반응형 제품 페이지 구성을 보여주기 위해 데스크톱 기준 `1280x900`입니다. 모바일 `390x844`, 태블릿 `768x1024`은 보조 검증용으로 사용합니다.

## Capture Checklist

- `01-landing-hero`: 제품 메시지, 데이터 상태 칩, CTA가 보이는 랜딩 히어로
- `02-app-preview-home`: 제품 페이지 안에 삽입된 앱 preview 홈 화면
- `03-golden-time`: 보호 종료가 가까운 공고 중심의 골든타임 탭
- `04-notices-filter`: 공고 필터와 표시 수 조절 컨트롤이 함께 보이는 공고 탭
- `05-region-explorer`: 권역 선택 패널과 지역 신호가 보이는 지역 탐색 탭
- `06-detail-sheet`: 공식 공고 정보, 동물 정보, 보호소 및 연락처가 보이는 상세 시트
- `07-data-pipeline`: Public API에서 Static JSON, PWA까지 이어지는 파이프라인 섹션
- `08-operational-db-badge`: 배포된 PWA에서 Operational DB badge가 보이는 모바일 화면
- `09-api-notices-operational-response`: `/api/notices?limit=100` operational response 확인 화면

## Current Screenshot Set

```text
01-landing-hero.png
02-app-preview-home.png
03-golden-time.png
04-notices-filter.png
05-region-explorer.png
06-detail-sheet.png
07-data-pipeline.png
08-operational-db-badge.png
09-api-notices-operational-response.png
```

스크린샷은 실제 운영 기능을 과장하지 않도록 현재 구현된 V1.5 상태를 그대로 보여줍니다. `09-api-notices-operational-response.png`는 공개 API 응답 필드만 포함하며 `DATABASE_URL`, Neon password, service key 같은 secret을 포함하지 않습니다.
