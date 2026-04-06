#!/usr/bin/env bash
# Update a v0.2 template (creates new version) — expect 200
# Uses the v0.2 SOAP seed by default, or pass a custom ID
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEMPLATE_ID="${1:-c4d2e8f3-6a5b-4b90-ad23-e9f7f3b2c4d5}"

echo "==> PUT /api/clinical/templates/$TEMPLATE_ID (update name + content)"
resp=$(curl -s -w '\n%{http_code}' \
  -X PUT \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "SOAP Note v0.2 — Physiotherapy (updated)",
    "content": {
      "schemaVersion": "0.2",
      "locale": ["fr", "en"],
      "pages": [
        {
          "key": "soap",
          "label": { "fr": "Note SOAP — Suivi (mis a jour)", "en": "SOAP Note — Follow-up (updated)" },
          "sections": [
            {
              "key": "subjective",
              "label": { "fr": "Subjectif", "en": "Subjective" },
              "rows": [
                {
                  "columns": [
                    {
                      "key": "current_pain",
                      "label": { "fr": "Douleur actuelle (EVA)", "en": "Current Pain (VAS)" },
                      "type": "scale",
                      "required": true,
                      "config": { "min": 0, "max": 10, "step": 0.5, "unit": "/10" }
                    }
                  ]
                },
                {
                  "columns": [
                    {
                      "key": "patient_report",
                      "label": { "fr": "Rapport du patient", "en": "Patient Report" },
                      "type": "narrative",
                      "required": true,
                      "config": {
                        "placeholder": { "fr": "Symptomes et evolution", "en": "Symptoms and progress" }
                      }
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
  "$BASE_URL/api/clinical/templates/$TEMPLATE_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
