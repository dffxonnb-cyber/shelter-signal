# Shelter Signal V2 Roadmap

## Current Baseline

Shelter Signal `main` currently uses the live-first Production architecture.

Completed baseline:

- live public notice API as the primary `/api/notices` source
- KST rolling 30-day collection and freshness filtering
- current, urgent, protected, archive view separation
- server-side region filtering and page/limit pagination
- normalized live-data cache, in-flight request sharing, and safe diagnostics
- explicit live/cache/fallback/empty-state UI
- notice-derived `/api/shelters` contact context
- static/mock and optional PostgreSQL fallback

The older Neon operational DB primary path is archived in [neon-deployment.md](neon-deployment.md). It is not the current baseline.

## V2 Definition

V2 is a local preview and dry-run track for alert-candidate and digest generation. It is not a Production notification service.

```text
Docker PostgreSQL
→ SQL models
→ mart.alert_candidates
→ daily digest JSON/HTML preview
→ optional local n8n or Mailpit validation
```

## Allowed Scope

- `mart.alert_candidates` SQL view
- daily digest preview export
- local dry-run scripts
- local n8n HTTP Request testing
- local Mailpit rendering checks
- generated preview verification

## Out Of Scope

- real external email, SMS, or push delivery
- SMTP/Gmail credentials or OAuth
- real recipients and subscription management
- authentication
- activated Production schedules
- Production monitoring or delivery SLA
- changing the live-first `/api/notices` architecture

## Local Revalidation

```powershell
python scripts/validate_pipeline.py
python scripts/run_daily_digest_dry_run.py
cd app
npm run lint
npm run typecheck
npm run build
```

Generated preview files under `data/exports/` must remain uncommitted.

## Safety Boundaries

- Do not commit or log database URLs, service keys, SMTP credentials, tokens, or real recipients.
- Do not present local Mailpit or n8n dry-run as Production notification readiness.
- Keep the current live-first notice pipeline unchanged while experimenting with local alert previews.

## Future Candidates

These items require a separate decision and are not needed for the current portfolio baseline:

- consented saved-notice and subscription design
- shared cache only if cross-instance consistency becomes necessary
- Production monitoring only if the project becomes an operated service
- external notification provider evaluation
