#!/bin/bash
# PUT /templates/:id — Create a new version of a template
# Usage: ./07-put-new-version.sh <template-id>
TEMPLATE_ID="${1:?Usage: $0 <template-id>}"
resp=$(curl -s -w '\n%{http_code}' -X PUT "http://localhost:3000/api/clinical/templates/$TEMPLATE_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Template v2",
    "content": { "sections": ["subjective", "objective", "assessment", "plan", "education"] }
  }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
