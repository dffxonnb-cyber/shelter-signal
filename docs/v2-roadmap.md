# Shelter Signal V2 Roadmap

## V2 한 줄 정의

“Shelter Signal V2는 구조동물 공고 데이터를 매일 자동 수집하고, 보호 종료가 가까운 공고를 이메일 요약으로 알려주는 n8n 기반 알림 파이프라인이다.”

## V2 목표

V2의 목표는 V1에서 만든 데이터 파이프라인과 PWA 기반을 유지하면서, 매일 확인해야 하는 공고를 자동으로 모으고 요약하는 알림 흐름을 설계하는 것입니다.

우선 구현 방향은 다음 세 가지에서 시작합니다.

- SQL alert candidate model
- email digest preview export
- n8n workflow documentation

V2는 아직 production-ready 알림 서비스가 아닙니다. 이 문서는 구현 전에 범위와 검증 기준을 고정하기 위한 계획 문서입니다.

## V1과 V2의 차이

| 구분 | V1 | V2 계획 |
| --- | --- | --- |
| 목적 | 구조동물 공고 우선순위를 PWA에서 확인 | 매일 수집된 공고 중 알림 후보를 요약 |
| 수집 | 로컬 스크립트와 mock 기반 검증 | n8n scheduled ingestion 구상 |
| 앱 데이터 | exported static JSON 로딩 | 필요 시 static JSON refresh를 선택적으로 연결 |
| 알림 | 없음 | email digest preview부터 설계 |
| 운영 상태 | 배포된 포트폴리오용 MVP | 별도 브랜치의 계획 및 후속 구현 범위 |

V1은 `v1.0.0` 태그 기준으로 안정 상태를 유지합니다. V2 작업은 `v2/n8n-email-alerts` 브랜치에서 분리해 진행합니다.

## V2 핵심 기능

- n8n scheduled workflow로 구조동물 공고 API를 주기적으로 호출하는 흐름 설계
- PostgreSQL upsert를 통해 중복 공고 적재를 막는 수집 흐름 설계
- SQL models 위에 `alert_candidates` layer를 추가하는 구상
- 보호 종료가 가까운 공고를 email digest preview 형태로 export
- 실제 이메일 발송 전, preview 파일과 로그로 알림 내용을 검증
- 필요할 경우 V1 PWA가 읽는 static JSON을 갱신하는 전략 검토

## 데이터 흐름

```text
Public API
→ n8n scheduled ingestion
→ PostgreSQL upsert
→ SQL models
→ alert_candidates
→ email digest preview
→ later email sending
→ optional static JSON refresh
```

초기 V2에서는 `email digest preview`까지를 우선 검증합니다. 실제 이메일 발송은 preview 결과와 안전 기준이 확인된 뒤 다음 단계로 분리합니다.

## n8n 자동 수집 구상

n8n workflow는 매일 정해진 시간에 구조동물 공고 API를 호출하고, 응답을 PostgreSQL 적재 형식으로 변환하는 역할을 맡습니다.

초기 구상은 다음과 같습니다.

- Schedule Trigger로 하루 1회 실행
- API 요청 노드에서 구조동물 공고 조회
- 응답 검증 노드에서 필수 필드 존재 여부 확인
- 변환 노드에서 기존 raw table grain에 맞게 필드 매핑
- PostgreSQL 노드에서 `source + desertion_no` 기준 upsert 실행
- 실행 결과를 n8n execution log와 별도 preview 파일로 확인

실제 API key는 n8n credential 또는 환경 변수로만 관리하며, 저장소 문서나 예시 코드에 포함하지 않습니다.

## 이메일 요약 알림 구상

이메일 알림은 바로 발송하지 않고, 먼저 digest preview를 만드는 방식으로 시작합니다.

초기 email digest preview에는 다음 정보를 포함합니다.

- 기준일
- 알림 후보 공고 수
- `긴급 확인`, `곧 종료` 후보 요약
- 공고번호, 축종, 품종, 지역, 보호소, 보호 종료일
- Rescue Window Score와 후보 선정 사유
- 공식 문의는 보호소 또는 관할기관을 통해 확인해야 한다는 안내

이 단계에서는 실제 구독자 관리, 대량 발송, unsubscribe, bounce 처리, 발송 평판 관리를 구현하지 않습니다.

## alert_candidates SQL layer 구상

`alert_candidates`는 기존 SQL models 위에 추가될 예정인 알림 후보 layer입니다. 이 문서 단계에서는 SQL 파일이나 DB schema를 변경하지 않습니다.

후보 선정 기준은 다음 신호를 조합하는 방향으로 검토합니다.

- 보호 종료일까지 남은 일수
- 공고 진행 상태
- Rescue Window Score
- 사진 여부
- 보호소 전화번호 여부
- 지역별 긴급 후보 수
- 이전 실행 대비 신규 후보 여부

예상 출력 grain은 공고 1건당 1행입니다. 향후 구현 시 preview export와 이메일 digest가 같은 후보 결과를 사용하도록 설계합니다.

## static JSON refresh strategy

V1 PWA는 현재 `app/public/data/*.json`으로 export된 정적 JSON 데이터를 읽습니다. V2에서도 앱을 즉시 live backend로 바꾸지 않습니다.

선택 가능한 refresh 전략은 다음과 같습니다.

- 수집과 알림 후보 검증만 먼저 진행하고 PWA JSON은 수동 export 유지
- n8n 실행 후 별도 스크립트로 static JSON export를 재생성
- preview 검증이 끝난 뒤에만 배포용 JSON 갱신을 수동 승인
- 자동 배포까지는 연결하지 않고, Vercel 배포는 별도 단계로 유지

초기 V2 범위에서는 JSON refresh를 선택 사항으로 두고, 알림 후보와 digest preview의 정확성을 먼저 확인합니다.

## 범위에 포함되는 것

- V2 로드맵과 workflow 문서화
- n8n scheduled ingestion 설계
- PostgreSQL upsert 흐름 설계
- `alert_candidates` SQL layer 설계
- email digest preview export 설계
- static JSON refresh 전략 검토
- V1 안정 상태와 V2 계획 범위 분리

## 범위에서 제외하는 것

- SMS
- user accounts
- real saved notice persistence
- production email subscription system
- real-time backend API
- map SDK
- shelter homepage enrichment
- 실제 이메일 발송 구현
- n8n workflow 파일 구현
- DB schema 변경
- 앱 동작 변경

## 단계별 로드맵

1. V2 planning branch 생성 및 문서화
2. `alert_candidates` SQL layer 기준 정의
3. email digest preview 파일 형식 정의
4. n8n workflow 초안 문서 작성
5. mock 또는 exported JSON 기준 preview 생성 검증
6. PostgreSQL upsert와 alert 후보 계산 연결
7. 안전 기준을 만족할 때만 email sending 단계 검토
8. 필요 시 static JSON refresh와 배포 흐름 분리 설계

## 검증 기준

- V1 앱 동작과 배포 설정이 변경되지 않을 것
- DB schema 변경 없이 문서와 계획만 추가될 것
- 후보 선정 기준이 Rescue Window Score와 종료일 신호를 설명 가능하게 사용할 것
- digest preview가 실제 발송 전 사람이 검토할 수 있는 형태일 것
- API key, 이메일 credential, 개인 정보가 저장소에 포함되지 않을 것
- 실패한 수집 실행이 기존 static JSON 배포 상태를 깨뜨리지 않을 것
- `git diff --check`가 통과할 것

## 윤리/안전 기준

- Shelter Signal은 공식 입양 가능성 예측이나 위험 판정 시스템이 아닙니다.
- Rescue Window Score는 공고 확인 순서를 돕는 내부 탐색 신호로만 사용합니다.
- 이메일 요약에는 공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해야 한다는 안내를 포함합니다.
- 개인정보, API key, 이메일 credential, 전화번호 원본 이상의 민감 정보를 불필요하게 저장하지 않습니다.
- 알림 문구는 긴급성을 과장하지 않고, 공고 상태가 변할 수 있음을 명확히 알립니다.
- production email subscription system이 준비되기 전에는 실제 구독자 대상 발송을 진행하지 않습니다.

## 향후 V3 후보

- 사용자 관심 지역 설정
- 저장 공고 persistence
- 이메일 구독 관리와 unsubscribe 흐름
- 보호 종료일 변화 감지
- shelter homepage enrichment 재검토
- 지도 기반 지역 탐색
- 관리자용 알림 후보 검토 화면
- 실시간 backend API
- 배포 자동화와 observability
