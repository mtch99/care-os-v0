#!/usr/bin/env bash
# Create template with invalid content (missing schemaVersion) — expect 400
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> POST /api/clinical/templates (missing schemaVersion — should be 400)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Bad Template",
    "discipline": "physiotherapy",
    "appointmentType": "follow_up",
    "content": {
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
