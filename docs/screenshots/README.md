# Shelter Signal Screenshots

이 폴더는 Shelter Signal의 제품 흐름과 구현 이력을 설명하는 tracked screenshot set입니다.

## Current V2 Capture Set

최종 V2 포트폴리오 캡처는 아래 두 장을 우선 사용합니다.

```text
11-v2-today-changes-2026-07.png
12-v2-deadline-briefing-2026-07.png
```

### 11 · Today Changes

Production route:

```text
https://shelter-signal-ebon.vercel.app/#changes
```

한 화면에 포함할 요소:

- `Shelter Signal V2`
- 오늘 감지 변화 수
- 새 공고·마감 변화·상태 변화·미관측 요약
- Collection health의 마지막 수집, 현재 관측, 이전 대비
- 수집 범위 완료와 동일 조회 창 표시
- 실제 동물 연락처나 불필요한 공고 행이 과도하게 노출되지 않는 구도

### 12 · Deadline Briefing

Production route:

```text
https://shelter-signal-ebon.vercel.app/#briefing
```

한 화면에 포함할 요소:

- `오늘의 마감 브리핑`
- D-Day, D-1, D-2, D-3 요약 카드
- 지역·마감일 필터
- 포함 근거가 보이는 우선 공고 카드 1~3개
- 화면 하단의 예측이 아니라는 선정 기준 문구가 가능하면 일부 포함

권장 캡처:

- Desktop: 1440px 이상, 브라우저 확대 90~100%
- Mobile: 390×844 전후의 추가 캡처는 선택 사항
- 개인 프로필 사진, 브라우저 북마크, 다른 탭, GitHub secret 화면은 제외

V2 스크린샷 파일은 실제 Production 화면을 캡처한 뒤에만 추가합니다. 생성 이미지나 mockup을 Production evidence로 사용하지 않습니다.

## Historical Product-flow Screenshots

다음 `01`~`07` 캡처는 초기 제품 흐름 설명용입니다. 현재 V2 UI와 일치하지 않을 수 있으므로 최종 대표 이미지보다 구현 이력으로 취급합니다.

- `01-landing-hero.png`: 제품 메시지와 CTA
- `02-app-preview-home.png`: 앱 preview 홈
- `03-golden-time.png`: 종료 임박 공고 흐름
- `04-notices-filter.png`: 공고 필터
- `05-region-explorer.png`: 지역 탐색
- `06-detail-sheet.png`: 공고 상세와 연락 맥락
- `07-data-pipeline.png`: 당시 데이터 흐름 설명

## Historical Operational DB Evidence

다음 캡처는 2026-06-05 이전 PostgreSQL-primary 검증 단계의 historical evidence입니다.

- `08-operational-db-badge.png`
- `09-api-notices-operational-response.png`

현재 Production은 live-first public API 구조이므로 이 두 파일을 현재 source 증거로 사용하지 않습니다.

## Historical Live-first Evidence

- `10-live-first-production-ui-2026-06-15.png`

2026-06-15 KST의 V1 live-first smoke test 캡처입니다. `Live API`, KST 조회 기간, 수집 페이지, 결과 수, cache 상태와 pagination을 보여줍니다.

Related evidence:

- [Historical Production verification](../evidence/production-verification-2026-06-15.md)
- [Current V2 Production verification](../evidence/v2-production-verification-2026-07-14.md)

## Capture Safety

- service key, `DATABASE_URL`, connection string, secret 환경 값, full secret-bearing upstream URL을 포함하지 않습니다.
- fallback 화면을 live 화면으로 소개하지 않습니다.
- 공고의 공개 연락처가 캡처에 포함되면 포트폴리오에 필요한 최소 범위인지 확인합니다.
- 캡처 시점과 현재 구현이 다르면 historical 또는 archived로 명확히 표시합니다.
- GitHub Actions 화면을 캡처할 때 repository secret 목록이나 개인 브라우저 UI가 보이지 않게 자릅니다.
