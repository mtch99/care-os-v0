#!/usr/bin/env bash
# Create template with isDefault:true for an existing discipline+appointmentType — expect 409
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> POST /api/clinical/templates (isDefault:true conflict — should be 409)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Duplicate Default — Physio Initial",
    "discipline": "physiotherapy",
    "appointmentType": "initial",
    "isDefault": true,
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
              "label": { "fr": "Section", "en": "Section" },
              "rows": [
                {
                  "columns": [
                    {
                      "key": "f1",
                      "label": { "fr": "Champ", "en": "Field" },
                      "type": "text",
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
