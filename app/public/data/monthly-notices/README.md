@`
# Monthly Notice Snapshots
This directory stores generated monthly public-data snapshot files.

Expected generated files:

- YYYY-MM.json
- YYYY-MM.meta.json

Each .meta.json file should follow this schema:

- docs/schemas/monthly-notice-snapshot-meta.schema.json

This directory is intentionally tracked before the first generated snapshot so the workflow  output path is clear.
`@ | Set-Content -Encoding UTF8 "app\public\data\monthly-notices\README.md"