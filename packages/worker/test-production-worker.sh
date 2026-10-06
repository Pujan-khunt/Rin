#!/usr/bin/env bash

IFS= read -rsp "Enter the shared secret key (RIN_CLIENT_KEY): " RIN_CLIENT_KEY
echo

curl -i -X POST "https://rin-worker.pujankhunt.me/solve" \
      -H "Origin: http://localhost" \
      -H "Content-Type: application/json" \
      -H "X-Rin-Client: ${RIN_CLIENT_KEY}" \
      -d '{
        "question": "What is 2 + 2?",
        "options": [
          {"label": "A", "text": "3"},
          {"label": "B", "text": "4"}
        ]
      }'
