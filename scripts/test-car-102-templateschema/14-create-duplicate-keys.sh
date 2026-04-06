#!/usr/bin/env bash
# Create template with duplicate field keys — expect 422 (semantic validation)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> POST /api/clinical/templates (duplicate 'chief_complaint' keys — should be 422)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Duplicate Keys Template",
    "discipline": "ergotherapy",
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
                      "key": "chief_complaint",
                      "label": { "fr": "Plainte principale", "en": "Chief Complaint" },
                      "type": "narrative",
                      "required": true,
                      "config": {}
                    },
                    {
                      "key": "chief_complaint",
                      "label": { "fr": "Plainte (doublon)", "en": "Complaint (dup)" },
                      "type": "narrative",
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
