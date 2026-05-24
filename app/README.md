# Shelter Signal App

Vite + React + TypeScript 기반 Shelter Signal PWA입니다.

앱은 `public/data/*.json`에 export된 정적 JSON을 먼저 읽고, 로딩에 실패하면 `src/data/mockAnimals.ts`의 mock 데이터로 fallback합니다. 브라우저에서 PostgreSQL이나 공공 API에 직접 연결하지 않습니다.

## 실행

```powershell
npm install
npm run dev
npm run build
```

`npm`이 PATH에 없다면 로컬 의존성이 설치된 상태에서 다음 빌드 검증을 사용할 수 있습니다.

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
```

## 현재 화면

- 홈
- 골든타임
- 공고 필터와 표시 수 조절
- 지역 신호 탐색기
- 저장 공고 placeholder
- 공고 상세 시트와 보호소 문의 안내

인증, email/SMS 알림, n8n 자동화, 운영용 backend API 연결은 아직 포함하지 않았습니다.
