# Test Scripts — CAR-102 TemplateSchema v0.2

Manual curl tests for the clinical template CRUD endpoints with v0.2 content validation.

## Prerequisites

1. PostgreSQL running: `pnpm db:up`
2. Migrations applied: `pnpm db:migrate:apply`
3. Database seeded: `pnpm db:seed`
4. API server running: `pnpm dev` (or `pnpm --filter @careos/api dev`)
5. `jq` installed for JSON formatting

## Scripts

| #   | Script                        | Method | Endpoint                                         | Expected | What it tests                                                 |
| --- | ----------------------------- | ------ | ------------------------------------------------ | -------- | ------------------------------------------------------------- |
| 01  | list-all-templates.sh         | GET    | /api/clinical/templates                          | 200      | All 6 templates returned (4 v0.1 + 2 v0.2)                    |
| 02  | get-v2-initial-by-id.sh       | GET    | /api/clinical/templates/:id                      | 200      | v0.2 initial eval retrieved with rich content                 |
| 03  | get-v2-soap-by-id.sh          | GET    | /api/clinical/templates/:id                      | 200      | v0.2 SOAP note retrieved with rich content                    |
| 04  | get-nonexistent-template.sh   | GET    | /api/clinical/templates/:id                      | 404      | TemplateNotFoundError                                         |
| 05  | list-physio-templates.sh      | GET    | /api/clinical/templates?discipline=physiotherapy | 200      | Filter returns 4 physio templates (2 v0.1 + 2 v0.2)           |
| 06  | get-default-physio-initial.sh | GET    | /api/clinical/templates/default                  | 200      | Default is still the v0.1 seed                                |
| 07  | create-v2-template.sh         | POST   | /api/clinical/templates                          | 422      | Duplicate field keys rejected by semantic validation (Pass 2) |
| 08  | create-invalid-content.sh     | POST   | /api/clinical/templates                          | 400      | Missing schemaVersion rejected                                |
| 09  | create-invalid-field-type.sh  | POST   | /api/clinical/templates                          | 400      | Unknown field type "dropdown" rejected                        |
| 10  | update-v2-template.sh         | PUT    | /api/clinical/templates/:id                      | 200      | Version bump with v0.2 content                                |
| 11  | archive-v2-template.sh        | DELETE | /api/clinical/templates/:id                      | 200      | Soft-delete non-default v0.2 template                         |
| 12  | set-default-v2-template.sh    | PATCH  | /api/clinical/templates/:id/set-default          | 200      | Promote v0.2 template to default                              |
| 13  | create-default-conflict.sh    | POST   | /api/clinical/templates                          | 409      | DefaultAlreadyExistsError                                     |
| 14  | create-duplicate-keys.sh      | POST   | /api/clinical/templates                          | 422      | TemplateValidationError — duplicate field keys (Pass 2)       |

## Usage

Run sequentially (scripts 07+ mutate state):

```bash
cd scripts/test-car-102-templateschema
for f in ./*.sh; do echo "--- $f ---"; bash "$f"; echo; done
```

Or run individually:

```bash
./01-list-all-templates.sh
./07-create-v2-template.sh
# Pass a custom ID to scripts that accept one:
./10-update-v2-template.sh <template-id>
```

Override base URL:

```bash
BASE_URL=http://localhost:4000 ./01-list-all-templates.sh
```

## SQL Verification Queries

Run these in your DB explorer (`psql`, TablePlus, etc.) after testing:

```sql
-- Count all templates (expect 6 after seed, more after creates)
SELECT count(*) FROM chart_note_templates;

-- List v0.2 templates (content has schemaVersion key)
SELECT id, name, discipline, appointment_type, is_default, is_archived, version
FROM chart_note_templates
WHERE content->>'schemaVersion' = '0.2'
ORDER BY created_at;

-- Verify v0.2 seeds are not default
SELECT id, name, is_default
FROM chart_note_templates
WHERE id IN (
  'b3a1c7d2-5e4f-4a89-9c12-d8f6e2a1b3c4',
  'c4d2e8f3-6a5b-4b90-ad23-e9f7f3b2c4d5'
);

-- Check default uniqueness constraint (one default per discipline+appointmentType)
SELECT discipline, appointment_type, count(*) AS default_count
FROM chart_note_templates
WHERE is_default = true AND is_archived = false
GROUP BY discipline, appointment_type
HAVING count(*) > 1;
-- (should return 0 rows)

-- Check version chains
SELECT id, name, version, parent_template_id
FROM chart_note_templates
WHERE parent_template_id IS NOT NULL
ORDER BY parent_template_id, version;
```
