# Shelter Signal Portfolio Summary

## Project Title

Shelter Signal

Production link: https://shelter-signal-ebon.vercel.app/

## V1 Summary

Shelter Signal is a public-data-based rescued-animal risk exploration PWA. The deployed V1 app uses a Vercel serverless API route to call the data.go.kr rescued-animal notice API and derive shelter/contact context from notice fields such as `careNm`, `careTel`, `careAddr`, and `orgNm`.

The shelter/contact list is notice-derived. It is not a complete official shelter directory, and final confirmation should be done through the shelter or relevant authority. Static JSON fallback/demo data is preserved, and no database is required for the current V1 live API route.

## V2 Alert Pipeline Summary

**Korean**

V2에서는 보호 종료 임박 공고를 PostgreSQL 기반 후보 테이블로 선별하고, 이메일 다이제스트 HTML을 생성한 뒤, n8n HTTP dry-run과 Mailpit 로컬 SMTP 캡처를 통해 실제 외부 발송 없이 알림 파이프라인을 검증했습니다.

**English**

V2 validates the alert pipeline by selecting near-deadline rescue notices from PostgreSQL, generating an email digest HTML, exposing it through an n8n dry-run bridge, and verifying local SMTP capture with Mailpit without sending real external email.

## Portfolio Card Copy

공공데이터 구조동물 공고 API를 Vercel 서버리스 함수로 호출하고, 공고 데이터에 포함된 보호소명, 전화번호, 주소, 관할기관 정보를 추출해 보호소 연락 맥락을 제공하는 구조동물 리스크 탐색 서비스.

## Key Highlights

- V1 public PWA with a Vercel serverless API route and notice-derived shelter/contact summaries
- Static JSON fallback/demo data preserved for resilience and portfolio review
- V2 PostgreSQL alert candidate foundation for near-deadline rescued animal notices
- Daily digest JSON/HTML preview generation
- n8n HTTP dry-run bridge with optional `email_html` payload
- Mailpit local SMTP capture smoke test with no real external email delivery

## Screenshot References

- Home: `docs/screenshots/01-home.png`
- Golden Time: `docs/screenshots/02-golden-time.png`
- Notice filters: `docs/screenshots/03-notices.png`
- Detail sheet: `docs/screenshots/04-detail-sheet.png`
- Region explorer: `docs/screenshots/05-region-explorer.png`
- Saved screen: `docs/screenshots/06-saved.png`

## Boundaries

- Shelter Signal is not a production shelter service.
- The V1 shelter/contact summaries are derived from rescued-animal notice fields, not from a complete official shelter directory.
- V2 Mailpit validation proves local SMTP send, inbox capture, and HTML rendering only.
- Gmail, Google Cloud OAuth, app passwords, production email sending, real recipients, SMS, auth, and subscriptions are intentionally not implemented.
- Rescue Window Score is an internal exploration signal, not an official risk score or prediction model.
