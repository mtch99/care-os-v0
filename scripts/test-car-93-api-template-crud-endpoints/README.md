# Template CRUD Test Scripts

Manual curl scripts for testing the `/api/clinical/templates` endpoints.

## Prerequisites

- API server running: `pnpm --filter @careos/api dev`
- Database seeded: `pnpm db:seed`
- Migration applied: `pnpm db:migrate:apply`
- `jq` installed for JSON formatting

## Make scripts executable

```bash
chmod +x scripts/test-templates/*.sh
```

## Test flow

Run in order — later scripts need IDs from earlier ones.

| #   | Script                                | Expected                         | Notes                       |
| --- | ------------------------------------- | -------------------------------- | --------------------------- |
| 01  | `./01-create-template.sh`             | 201 — new template               | Save the `id` from response |
| 02  | `./02-create-default-conflict.sh`     | 409 — DEFAULT_ALREADY_EXISTS     | Seed data has defaults      |
| 03  | `./03-list-templates.sh`              | 200 — all non-archived templates | Seed data + script 01       |
| 04  | `./04-list-filtered.sh`               | 200 — filtered list              | physio/follow_up only       |
| 05  | `./05-get-by-id.sh <id>`              | 200 — single template            | Use ID from 01              |
| 06  | `./06-get-default.sh`                 | 200 — default template           | Defaults: physio/follow_up  |
| 07  | `./07-put-new-version.sh <id>`        | 200 — new version (v2)           | Use a seed template ID      |
| 08  | `./08-set-default.sh <id>`            | 200 — default reassigned         | Use ID from 01              |
| 09  | `./09-delete-default-blocked.sh <id>` | 409 — CANNOT_ARCHIVE_DEFAULT     | Use the new default ID      |
| 10  | `./10-delete-archive.sh <id>`         | 200 — archived                   | Use a non-default ID        |
| 11  | `./11-validation-error.sh`            | 400 — VALIDATION_ERROR           | Bad input                   |
| 12  | `./12-get-not-found.sh`               | 404 — TEMPLATE_NOT_FOUND         | Fake UUID                   |

## DB verification queries

Run these in your DB explorer to verify state after testing:

```sql
-- All templates with version info
SELECT id, name, discipline, appointment_type, version, parent_template_id, is_default, is_archived
FROM chart_note_templates
ORDER BY discipline, appointment_type, version;

-- Check only one default per discipline+type
SELECT discipline, appointment_type, count(*) as default_count
FROM chart_note_templates
WHERE is_default = true
GROUP BY discipline, appointment_type;

-- Version chains
SELECT id, name, version, parent_template_id
FROM chart_note_templates
WHERE parent_template_id IS NOT NULL
ORDER BY parent_template_id, version;
```
