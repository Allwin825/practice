#!/usr/bin/env bash
# check-privacy.sh — verifies zero network calls for user data in src/ and app/
# Fails (exit 1) if any fetch/axios/XMLHttpRequest usage is found outside of
# node_modules or test fixtures.

set -euo pipefail

SEARCH_DIRS="src app"
EXIT_CODE=0

echo "=== BudgetVault Privacy Check ==="
echo "Scanning: $SEARCH_DIRS"
echo ""

# Pattern 1: fetch( — catches window.fetch, global fetch, inline fetch(
if grep -rn --include="*.ts" --include="*.tsx" \
    -E '\bfetch\s*\(' $SEARCH_DIRS 2>/dev/null; then
  echo ""
  echo "FAIL: fetch() call found above. User data must never leave the device."
  EXIT_CODE=1
fi

# Pattern 2: axios usage
if grep -rn --include="*.ts" --include="*.tsx" \
    -E '\baxios\b' $SEARCH_DIRS 2>/dev/null; then
  echo ""
  echo "FAIL: axios usage found above."
  EXIT_CODE=1
fi

# Pattern 3: XMLHttpRequest
if grep -rn --include="*.ts" --include="*.tsx" \
    -E '\bXMLHttpRequest\b' $SEARCH_DIRS 2>/dev/null; then
  echo ""
  echo "FAIL: XMLHttpRequest usage found above."
  EXIT_CODE=1
fi

# Pattern 4: WebSocket
if grep -rn --include="*.ts" --include="*.tsx" \
    -E '\bnew WebSocket\b' $SEARCH_DIRS 2>/dev/null; then
  echo ""
  echo "FAIL: WebSocket usage found above."
  EXIT_CODE=1
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "PASS: No network calls for user data found in $SEARCH_DIRS"
fi

exit $EXIT_CODE
