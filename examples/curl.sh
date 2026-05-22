#!/usr/bin/env bash
# Examples for testing the deployed Worker.
#
# Usage:
#   1. Deploy the Worker (see README) and set TURNSTILE_SECRET_KEY to a test
#      secret (1x0000000000000000000000000000000AA always passes).
#   2. Update WORKER_URL below to your deployed Worker URL.
#   3. Run this script.

set -euo pipefail

: "${WORKER_URL:=https://turnstile-verify-reference.example.workers.dev}"

echo "=== Health check ==="
curl -sS "$WORKER_URL/" | jq .
echo

echo "=== JSON body: success case (using test secret on Worker) ==="
curl -sS -X POST "$WORKER_URL/" \
	-H "Content-Type: application/json" \
	-d '{"token": "DUMMY.TOKEN", "remoteip": "203.0.113.5"}' | jq .
echo

echo "=== Form-encoded body: success case ==="
curl -sS -X POST "$WORKER_URL/" \
	-H "Content-Type: application/x-www-form-urlencoded" \
	--data-urlencode "token=DUMMY.TOKEN" \
	--data-urlencode "remoteip=203.0.113.5" | jq .
echo

echo "=== Form body using cf-turnstile-response alias (HTML <form> default) ==="
curl -sS -X POST "$WORKER_URL/" \
	-H "Content-Type: application/x-www-form-urlencoded" \
	--data-urlencode "cf-turnstile-response=DUMMY.TOKEN" | jq .
echo

echo "=== Missing token: expect 400 with missing-token error code ==="
curl -sS -X POST "$WORKER_URL/" \
	-H "Content-Type: application/json" \
	-d '{}' | jq .
echo

echo "=== Unsupported Content-Type: expect 415 ==="
curl -sS -X POST "$WORKER_URL/" \
	-H "Content-Type: text/plain" \
	-d 'token=abc' | jq .
echo
