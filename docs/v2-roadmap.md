# Shelter Signal V2 Roadmap

## V2 Definition

Shelter Signal V2 is finalized as a local-development alert pipeline validation for rescued-animal notices that are close to their protection end date.

It uses a PostgreSQL alert candidate layer, daily digest preview generation, an n8n HTTP dry-run bridge, and Mailpit local SMTP capture to verify the alert flow without sending real external email.

## Completed Local Scope

The `v2/n8n-email-alerts` branch now validates:

- Completed: alert candidate foundation through `mart.alert_candidates`
- Completed: email digest preview export to `data/exports/email_digest_preview.json`
- Completed: email digest preview export to `data/exports/email_digest_preview.html`
- Completed: n8n dry-run HTTP integration through `POST /dry-run`
- Completed: `email_html` payload through `POST /dry-run?include_html=true`
- Completed: Mailpit local email capture smoke test through `scripts/run_v2_mailpit_email_capture_test.py`

This is not a production notification service. It is a verified local pipeline stage that proves data selection, digest rendering, HTTP handoff, SMTP capture, and inbox inspection.

## Portfolio Summary

**Korean**

V2에서는 보호 종료 임박 공고를 PostgreSQL 기반 후보 테이블로 선별하고, 이메일 다이제스트 HTML을 생성한 뒤, n8n HTTP dry-run과 Mailpit 로컬 SMTP 캡처를 통해 실제 외부 발송 없이 알림 파이프라인을 검증했습니다.

**English**

V2 validates the alert pipeline by selecting near-deadline rescue notices from PostgreSQL, generating an email digest HTML, exposing it through an n8n dry-run bridge, and verifying local SMTP capture with Mailpit without sending real external email.

## Verified Flow

```text
PostgreSQL
-> SQL models
-> mart.alert_candidates
-> daily digest JSON/HTML preview
-> local dry-run HTTP bridge
-> optional n8n HTTP Request node
-> Mailpit local SMTP capture
-> Mailpit inbox verification
```

Recommended final local verification:

```powershell
python scripts/run_v2_mailpit_email_capture_test.py
```

The smoke test verifies:

- dry-run PASS
- HTML export PASS
- SMTP send PASS
- Mailpit inbox verification PASS
- subject, sender, recipient, HTML body, and `Shelter Signal` content

## V1 And V2 Separation

V1 remains the deployed public PWA experience. The current V1 live API route derives shelter/contact context from rescued-animal notice fields and preserves static JSON fallback/demo behavior.

V2 is a branch-local alert pipeline validation. It does not change the V1 deployed app UI, does not enable production sending, and does not add user-facing subscription behavior.

## Deferred

The following items are intentionally outside the finalized V2 local validation scope:

- production SMTP/email provider
- real recipients or subscriptions
- scheduling or workflow activation
- SMS
- cloud database-backed app
- user accounts or authentication
- unsubscribe, bounce handling, and delivery reputation management
- production monitoring for automated alert delivery

## Safety Boundaries

- Do not commit API keys, SMTP credentials, OAuth tokens, or real recipient addresses.
- Do not use Gmail OAuth, Google Cloud OAuth, Gmail SMTP, or app passwords for local testing.
- Do not treat Mailpit capture as external delivery readiness.
- Do not activate schedules or publish an automated workflow from this branch.
- Keep generated files under `data/exports/` out of Git.
- Keep V1 behavior and deployed app assumptions separate from V2 local validation.

## Future Work

Future work can evaluate production email infrastructure, consented recipient management, scheduling, unsubscribe handling, and deployment architecture as separate milestones after the local pipeline has been reviewed.
