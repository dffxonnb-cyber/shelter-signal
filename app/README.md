# Shelter Signal App

Vite + React + TypeScript 기반 Shelter Signal PWA입니다.

배포 링크: https://shelter-signal-ebon.vercel.app/

현재 배포된 앱은 export된 정적 JSON 데이터를 사용합니다. 운영용 실시간 backend, 인증, 알림 기능이 붙은 production-ready 서비스는 아닙니다.

앱은 `public/data/*.json`에 export된 정적 JSON을 먼저 읽고, 로딩에 실패하면 `src/data/mockAnimals.ts`의 mock 데이터로 fallback합니다. 브라우저에서 PostgreSQL이나 공공 API에 직접 연결하지 않습니다.

## Operational DB Note

`/api/notices`는 다음 backend 단계를 위한 server-only experimental operational DB route입니다. `DATABASE_URL`은 deployment environment에만 설정해야 하며, `VITE_` frontend 변수로 노출하면 안 됩니다. 프런트엔드는 아직 `public/data/*.json` 정적 파일을 primary data source로 사용합니다.

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

## Vercel 배포 설정

Vercel에서 이 앱을 배포할 때는 저장소 루트가 아니라 `app` 폴더를 프로젝트 루트로 지정합니다.

```text
Root Directory: app
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

`public/data/*.json` 파일은 현재 앱이 읽는 정적 export 데이터입니다. 배포 결과물에는 이 JSON 파일들이 `/data/*.json` 경로의 정적 자산으로 포함됩니다.

## 현재 화면

- 홈
- 골든타임
- 공고 필터와 표시 수 조절
- 지역 신호 탐색기
- 저장 공고 placeholder
- 공고 상세 시트와 보호소 문의 안내

인증, email/SMS 알림, n8n 자동화, 운영용 backend API 연결은 아직 포함하지 않았습니다. 배포는 포트폴리오 시연용 정적 PWA 배포로 다룹니다.
