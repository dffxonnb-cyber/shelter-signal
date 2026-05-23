# Shelter Signal App

Phase 2 앱은 mock 데이터 기반의 PWA 스타일 MVP 스캐폴드입니다. 아직 PostgreSQL, API 서버, 인증, 알림 기능과 연결하지 않았습니다.

앱은 Phase 1 SQL 모델의 핵심 개념인 Rescue Window Score를 화면에서 확인하기 위한 첫 시각화 레이어입니다.

## 실행

```powershell
npm install
npm run dev
npm run build
```

현재 데이터는 `src/data/mockAnimals.ts`에서 가져옵니다. 백엔드/API 연결은 이후 단계에서 추가합니다.
