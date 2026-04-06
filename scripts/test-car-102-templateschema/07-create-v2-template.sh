#!/usr/bin/env bash
# Create a new template with v0.2 content — expect 201
# Saves the created ID to stdout for use in subsequent scripts
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> POST /api/clinical/templates (v0.2 content)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test v0.2 — Ergo Initial",
    "discipline": "ergotherapy",
    "appointmentType": "initial",
    "isDefault": false,
    "content": {
      "schemaVersion": "0.2",
      "locale": ["fr", "en"],
      "pages": [
        {
          "key": "eval_page",
          "label": { "fr": "Page d'\''evaluation", "en": "Evaluation Page" },
          "sections": [
            {
              "key": "subjective",
              "label": { "fr": "Subjectif", "en": "Subjective" },
              "rows": [
                {
                  "columns": [
                    {
                      "key": "chief_complaint",
                      "label": { "fr": "Plainte principale", "en": "Chief Complaint" },
                      "type": "narrative",
                      "required": true,
                      "config": {
                        "placeholder": { "fr": "Decrivez la plainte", "en": "Describe the complaint" }
                      }
                    },
                    {
                      "key": "chief_complaint",
                      "label": { "fr": "Plainte principale", "en": "Chief Complaint" },
                      "type": "narrative",
                      "required": true,
                      "config": {
                        "placeholder": { "fr": "Decrivez la plainte", "en": "Describe the complaint" }
                      }
                    },
                    {
                      "key": "pain_level",
                      "label": { "fr": "Niveau de douleur", "en": "Pain Level" },
                      "type": "scale",
                      "required": true,
                      "config": { "min": 0, "max": 10, "step": 1, "unit": "/10" }
                    }
                  ]
                },
                {
                  "columns": [
                    {
                      "key": "onset_date",
                      "label": { "fr": "Date de debut", "en": "Onset Date" },
                      "type": "date",
                      "required": false,
                      "config": {}
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }' \
  "$BASE_URL/api/clinical/templates")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

# Extract the created template ID for use in later scripts
created_id=$(echo "$body" | jq -r '.data.id // empty')
if [ -n "$created_id" ]; then
  echo ""
  echo "Created template ID: $created_id"
  echo "Use this ID with scripts 10, 11, 12:"
  echo "  ./10-update-v2-template.sh $created_id"
  echo "  ./11-archive-v2-template.sh $created_id"
fi
