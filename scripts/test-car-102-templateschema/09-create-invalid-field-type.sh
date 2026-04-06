#!/usr/bin/env bash
# Create template with unknown field type — expect 400
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> POST /api/clinical/templates (unknown field type 'dropdown' — should be 400)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Bad Field Type Template",
    "discipline": "physiotherapy",
    "appointmentType": "follow_up",
    "content": {
      "schemaVersion": "0.2",
      "locale": ["fr", "en"],
      "pages": [
        {
          "key": "pg1",
          "label": { "fr": "Page 1", "en": "Page 1" },
          "sections": [
            {
              "key": "s1",
              "label": { "fr": "Section 1", "en": "Section 1" },
              "rows": [
                {
                  "columns": [
                    {
                      "key": "f1",
                      "label": { "fr": "Champ 1", "en": "Field 1" },
                      "type": "dropdown",
                      "required": false,
                      "config": { "options": ["a", "b"] }
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
