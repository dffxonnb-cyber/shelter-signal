# Shelter Signal

Shelter Signal은 현재 **API 스모크 테스트만 준비된 저장소**입니다. 아직 전체 앱, 자동화 파이프라인, 데이터베이스, 프론트엔드는 구현하지 않았습니다.

이 단계의 목적은 공공데이터포털의 `농림축산식품부 농림축산검역본부_국가동물보호정보시스템 구조동물 조회 서비스`를 아주 작은 요청으로 호출해 보고, 실제 응답 필드와 형식을 확인하는 것입니다.

## API 키 관리

실제 API 키는 로컬 `.env` 파일에만 둡니다. `.env` 파일은 Git에 커밋하지 않습니다.

```text
ANIMAL_API_KEY=발급받은_실제_키
```

저장소에는 예시 파일인 `.env.example`만 포함합니다.

## 실행 방법

```powershell
python -m py_compile scripts/test_animal_api.py
python scripts/test_animal_api.py
```

스크립트는 기본적으로 1회만 요청하며, `numOfRows`는 5로 제한되어 있습니다. JSON 응답을 먼저 요청하고, JSON 파싱에 실패하면 원본 XML 또는 텍스트 응답을 `data/raw/animal_api_sample.xml`에 저장합니다.

현재 검증 환경에서는 저장소 루트에 실제 `.env` 파일이 없어 API 요청을 실행하지 못했습니다. 이 경우 스크립트는 `ANIMAL_API_KEY was not found` 메시지를 출력하고 종료합니다. 실제 키를 로컬 `.env`에 넣은 뒤 다시 실행하면 됩니다.

저장되는 원본 샘플은 다음 경로를 사용합니다.

```text
data/raw/animal_api_sample.json
data/raw/animal_api_sample.xml
```

이 단계에서는 `data/raw`의 응답 샘플 파일을 Git에서 무시합니다. 실제 필드 구조를 확인하기 위한 로컬 점검용 파일입니다.

## 조정 가능한 값

API 세부 경로와 파라미터는 공식 문서를 확인한 뒤 쉽게 바꿀 수 있도록 `scripts/test_animal_api.py` 상단의 상수로 분리했습니다.

```python
BASE_URL
PAGE_NO
NUM_OF_ROWS
RESPONSE_TYPE
```

호출이 실패하면 다음 항목을 먼저 확인합니다.

- `.env` 파일이 저장소 루트에 있는지
- `.env` 안에 `ANIMAL_API_KEY`가 있는지
- 공공데이터포털에서 발급된 키가 활성화되었는지
- 공식 문서의 서비스 URL 또는 파라미터명이 변경되었는지

## 다음 단계

다음 작업은 로컬 응답 샘플의 필드 구조를 확인하고, Shelter Signal 앱의 기획 문서를 작성하는 것입니다. 이 저장소는 아직 완성된 앱이 아니라 API 연결 가능성을 검증하는 출발점입니다.
