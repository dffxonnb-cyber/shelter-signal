# Shelter Signal

Shelter Signal은 구조/유기동물 공고를 모니터링하고, 공고 종료까지 남은 시간을 기준으로 먼저 확인해야 할 대상을 정리하기 위한 프로젝트입니다.

현재 저장소는 **Phase 1 데이터 파이프라인 스캐폴드** 단계입니다. 전체 앱, 프론트엔드, 알림 기능, n8n 자동화, 운영용 배포는 아직 구현하지 않았습니다.

## Phase 1 범위

이번 단계에서 준비한 것은 다음 항목입니다.

- 공공데이터 구조동물 조회 API 응답을 담는 PostgreSQL raw 테이블
- API camelCase 필드를 DB snake_case 필드로 정규화하는 ingestion 스크립트
- 중복 적재를 막는 `source + desertion_no` 기준 upsert 구조
- Rescue Window Score를 계산하는 SQL clean 모델
- 지역, 보호소, 품종, 구조 윈도우별 요약 SQL 모델
- SQL 품질 테스트
- Docker Compose 기반 로컬 PostgreSQL
- mock 데이터로 전체 파이프라인을 검증하는 `scripts/validate_pipeline.py`

## API 키 관리

실제 API 키는 로컬 `.env` 파일에만 둡니다. `.env`는 Git에 커밋하지 않습니다.

```text
ANIMAL_API_KEY=발급받은_실제_키
```

저장소에는 예시 파일인 `.env.example`만 포함합니다. 스크립트는 API 키를 출력하지 않으며, README나 코드에도 실제 키를 넣지 않습니다.

## Mock / Live 분리

Phase 1 검증은 기본적으로 mock 데이터를 사용합니다.

- mock 데이터: `data/sample/rescued_animals_mock.json`
- live API 호출: `ANIMAL_API_KEY`가 있는 로컬 `.env` 필요
- DB 적재: `--load-db`를 명시한 경우에만 실행
- 기본 ingestion 동작: dry-run, DB write 없음

예시:

```powershell
python ingestion/run_animal_ingestion.py --mock
python ingestion/run_animal_ingestion.py --mock --load-db
python ingestion/run_animal_ingestion.py --num-of-rows 10
python ingestion/run_animal_ingestion.py --num-of-rows 10 --load-db
```

live API 호출은 한 번에 최대 10건만 요청하도록 제한했습니다. 대량 수집은 아직 이 단계의 범위가 아닙니다.

## Rescue Window Score

Shelter Signal의 핵심은 단순 목록이 아니라 **Rescue Window Score**입니다.

현재 SQL 모델은 다음 신호를 사용해 우선순위를 계산합니다.

- 공고 종료일까지 남은 일수
- 공고가 아직 진행 중인지 여부
- 사진 유무
- 보호소 전화번호 유무
- 특이사항 존재 여부

결과 라벨은 다음 중 하나로 분류됩니다.

- `긴급 확인`
- `곧 종료`
- `확인 필요`
- `여유 있음`
- `종료/확인 필요`

점수와 라벨은 `sql/models/001_animals_clean.sql`에서 계산합니다. 아직 운영 기준이 확정된 것은 아니며, 실제 응답 필드와 사용자 시나리오를 더 확인하면서 조정할 예정입니다.

## 로컬 검증

Docker가 실행 중인 상태에서 다음 명령을 실행합니다.

```powershell
python scripts/validate_pipeline.py
```

검증 스크립트는 다음 작업을 자동으로 수행합니다.

- Docker 및 PostgreSQL 사용 가능 여부 확인
- migration 적용
- mock 데이터 적재
- SQL 모델 생성
- SQL 테스트 실행
- analytics view 미리보기 출력
- PASS/FAIL 요약 출력

수동으로 `psql`을 실행할 필요가 없도록 구성했습니다.

## 주요 경로

```text
ingestion/run_animal_ingestion.py
scripts/test_animal_api.py
scripts/validate_pipeline.py
sql/migrations/001_create_raw_rescued_animals.sql
sql/models/
sql/tests/
data/sample/rescued_animals_mock.json
data/raw/
docs/
```

`data/raw`의 실제 API 응답 샘플은 현재 Git에서 무시합니다. 로컬 점검용 원본 파일을 실수로 커밋하지 않기 위한 설정입니다.

## 다음 단계

다음 단계는 실제 API 응답을 더 확인하면서 Rescue Window Score 기준을 다듬고, 앱 기획 문서와 최소 화면 흐름을 정리하는 것입니다. 현재 저장소는 운영 가능한 서비스가 아니라 Phase 1 데이터 기반을 검증하기 위한 준비 단계입니다.
