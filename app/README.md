# Shelter Signal App

Vite + React + TypeScript 기반 Shelter Signal PWA입니다. V1은 구조동물 공고 데이터와 공고에 포함된 보호소 연락 맥락을 모바일에서 탐색하는 포트폴리오용 서비스 실험입니다.

배포 링크: https://shelter-signal-ebon.vercel.app/

현재 배포된 앱은 공고와 지역 신호에 export된 정적 JSON 데이터를 사용하고, 지역 보호소 연락 맥락은 Vercel serverless API route인 `/api/shelters`를 통해 data.go.kr 구조동물 공고 API의 `careNm`, `careTel`, `careAddr`, `orgNm` 필드를 요약합니다. 운영용 실시간 backend, 인증, 알림 기능이 붙은 production-ready 서비스는 아닙니다.

앱은 `public/data/*.json`에 export된 정적 JSON을 먼저 읽고, 로딩에 실패하면 `src/data/mockAnimals.ts`의 mock 데이터로 fallback합니다. 브라우저에서 PostgreSQL이나 공공 API에 직접 연결하지 않습니다.

보호소 조회의 서비스 키는 브라우저 번들에 포함하지 않습니다. Vercel Production 환경 변수에 `DATA_GO_KR_SERVICE_KEY`를 설정해야 하며, 추가 또는 변경 후에는 Production을 다시 배포해야 합니다. 이 live shelter API route에는 Supabase/Postgres 같은 DB 연결이 필요하지 않습니다.

`/api/shelters`는 별도 보호소 센터 디렉터리가 아니라 구조동물 공고 응답의 `careNm`, `careTel`, `careAddr`, `orgNm` 값을 dedupe해 만든 공고 기반 보호소 연락 요약입니다. 별도 shelter-center API가 `403`을 반환해도 앱이 완전히 막히지 않도록 이 흐름을 우선 사용합니다. 최종 확인은 보호소 또는 관할기관을 통해 진행해야 합니다.

## V1 요약

공공데이터 구조동물 공고 API를 Vercel 서버리스 함수로 호출하고, 공고 데이터에 포함된 보호소명, 전화번호, 주소, 관할기관 정보를 추출해 보호소 연락 맥락을 제공하는 구조동물 리스크 탐색 서비스입니다.

Shelter Signal is a rescued-animal risk exploration service that uses a Vercel serverless API route to call the data.go.kr rescued-animal notice API and derive shelter contact context from notice fields such as `careNm`, `careTel`, `careAddr`, and `orgNm`.

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

`/api/shelters` 문제를 볼 때:

- `MISSING_SERVICE_KEY`: Vercel Function이 `DATA_GO_KR_SERVICE_KEY`를 보지 못하는 상태입니다.
- `UPSTREAM_ERROR`: 함수는 키를 받았지만 구조동물 공고 API 응답이나 권한에서 실패한 상태입니다.
- `UPSTREAM_FORBIDDEN`: data.go.kr가 `403`을 반환한 상태입니다. 서비스별 활용 승인, endpoint/operation 경로, 필수 파라미터, Encoding/Decoding key 혼동, serviceKey 이중 인코딩, 환경 변수의 공백/따옴표를 확인합니다.
- 직접 확인 URL: https://shelter-signal-ebon.vercel.app/api/shelters
- 로컬 진단: `python scripts/test_shelter_upstream_request.py`

## 현재 화면

- 홈
- 골든타임
- 공고 필터와 표시 수 조절
- 지역 신호 탐색기
- 저장 공고 placeholder
- 공고 상세 시트와 보호소 문의 안내

인증, email/SMS 알림, n8n 자동화, DB-backed 운영용 backend는 아직 포함하지 않았습니다. 배포는 포트폴리오 시연용 PWA와 Vercel 서버리스 API route 조합으로 다룹니다.
