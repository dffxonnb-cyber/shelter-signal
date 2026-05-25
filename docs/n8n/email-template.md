# Email Template Draft

## Purpose

이 문서는 Shelter Signal V2 email digest preview의 문구 방향을 정리합니다. 현재 단계에서는 실제 이메일을 보내지 않으며, `scripts/export_email_digest.py`가 생성하는 HTML preview를 사람이 먼저 확인합니다.

## Subject Draft

```text
[Shelter Signal] 오늘 확인할 보호 종료 임박 공고
```

## Preview Header

```text
Shelter Signal
보호 종료가 가까운 공고를 먼저 확인합니다.
```

## Opening Copy

```text
오늘 확인할 공고를 정리했어요.
```

## Safety Note

```text
공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요.
```

## Summary Line

```text
오늘 확인할 공고 N건
생성일: YYYY-MM-DD HH:mm
```

## Candidate Report Item

```text
1. [D-1] 믹스견
   서울특별시 마포구 · 마포도와동물보호센터
   보호 종료일: 2026-05-24
   Rescue Window: 80
   연락처: 02-000-0000
   사유: 보호 종료 임박
```

## Empty State Copy

```text
오늘 preview에 포함할 알림 후보가 없습니다.
```

## Footer Note

```text
이 메일은 Shelter Signal V2 알림 파이프라인 검증을 위한 미리보기입니다.
공식 문의와 최종 확인은 보호소 또는 관할기관을 통해 진행해주세요.
```

## Tone Rules

- 차분한 확인 안내로 작성합니다.
- 공식 문의와 최종 확인 경로를 함께 안내합니다.
- Rescue Window Score를 공식 위험 점수처럼 표현하지 않습니다.
- 공고 상태가 바뀔 수 있음을 전제로 문장을 씁니다.
- 공포, 죄책감, 즉시 행동 압박을 유도하는 문구는 사용하지 않습니다.
- marketing newsletter나 web app card UI처럼 보이지 않게 minimal daily report 형식을 유지합니다.
- 외부 CSS, 외부 폰트, JavaScript 없이 단순한 email-friendly HTML로 유지합니다.
- 큰 컬러 카드, 큰 배지, 그림자, 장식용 로고 마크를 사용하지 않습니다.

## Not Included Yet

- 실제 수신자 이메일
- SMTP/Gmail credential
- unsubscribe 문구와 링크
- production subscription copy
- SMS 문구
