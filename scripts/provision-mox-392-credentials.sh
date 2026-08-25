#!/usr/bin/env bash

set +x
set -Eeuo pipefail
umask 077

readonly SOURCE_REPO="thedoughmonster/momi-backend"
readonly TARGET_REPO="thedoughmonster/MoXX"
readonly GATEWAY_VARIABLE="MOMI_MODEL_EXECUTION_GATEWAY_URL"

usage() {
  cat <<'EOF'
Usage: scripts/provision-mox-392-credentials.sh

Copies the non-secret model gateway variable from the private MoMi repository
to the public MoXX repository, then securely prompts for the required write-only
GitHub Actions secrets. Secret values remain only in process memory long enough
to pipe them into GitHub CLI; they are never written to a file or printed.
EOF
}

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require_secret() {
  local name="$1"
  local environment="${2:-}"
  local present
  local secret_value

  if [[ -n "$environment" ]]; then
    printf '\nEnter %s for the %s environment.\n' "$name" "$environment"
    read -r -s -p 'Secret value: ' secret_value
    printf '\n'
    [[ -n "$secret_value" ]] || fail "$name cannot be empty"
    printf '%s' "$secret_value" | gh secret set "$name" \
      --repo "$TARGET_REPO" --env "$environment"
    present="$(gh secret list --repo "$TARGET_REPO" --env "$environment" \
      --json name --jq "map(.name) | index(\"$name\") != null")"
  else
    printf '\nEnter repository secret %s.\n' "$name"
    read -r -s -p 'Secret value: ' secret_value
    printf '\n'
    [[ -n "$secret_value" ]] || fail "$name cannot be empty"
    printf '%s' "$secret_value" | gh secret set "$name" --repo "$TARGET_REPO"
    present="$(gh secret list --repo "$TARGET_REPO" --json name \
      --jq "map(.name) | index(\"$name\") != null")"
  fi

  secret_value=""
  unset secret_value

  [[ "$present" == "true" ]] || fail "GitHub did not report $name after setting it"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
[[ "$#" -eq 0 ]] || fail "unexpected arguments; use --help"
[[ -t 0 && -t 1 ]] || fail "run this helper from an interactive trusted terminal"
command -v gh >/dev/null || fail "GitHub CLI is not installed"

login="$(gh api user --jq .login)"
[[ -n "$login" ]] || fail "GitHub CLI authentication is unavailable"

source_visibility="$(gh repo view "$SOURCE_REPO" --json visibility --jq .visibility)"
target_visibility="$(gh repo view "$TARGET_REPO" --json visibility --jq .visibility)"
[[ "$source_visibility" == "PRIVATE" ]] || fail "$SOURCE_REPO is not private"
[[ "$target_visibility" == "PUBLIC" ]] || fail "$TARGET_REPO is not public"

printf 'Authenticated GitHub account: %s\n' "$login"
printf 'Source: %s (%s)\n' "$SOURCE_REPO" "$source_visibility"
printf 'Target: %s (%s)\n' "$TARGET_REPO" "$target_visibility"
printf '\nThis will copy %s into the public target.\n' "$GATEWAY_VARIABLE"
printf 'GitHub Actions variables are non-secret and may appear unmasked in logs.\n'
printf 'Named target secrets will be created or replaced after hidden prompts.\n'
read -r -p 'Continue? Type PUBLIC MOXX to confirm: ' confirmation
[[ "$confirmation" == "PUBLIC MOXX" ]] || fail "confirmation did not match"

gateway_value="$(gh variable list --repo "$SOURCE_REPO" --json name,value \
  --jq ".[] | select(.name == \"$GATEWAY_VARIABLE\") | .value")"
[[ -n "$gateway_value" ]] || fail "$GATEWAY_VARIABLE is absent or empty in $SOURCE_REPO"
printf '%s' "$gateway_value" | gh variable set "$GATEWAY_VARIABLE" --repo "$TARGET_REPO"
gateway_value=""
unset gateway_value

variable_present="$(gh variable list --repo "$TARGET_REPO" --json name \
  --jq "map(.name) | index(\"$GATEWAY_VARIABLE\") != null")"
[[ "$variable_present" == "true" ]] || fail "GitHub did not report $GATEWAY_VARIABLE"

require_secret "MOMI_MODEL_GATEWAY_TRIAGE_SECRET"
require_secret "CLOUDFLARE_ACCOUNT_ID"
require_secret "CLOUDFLARE_API_TOKEN"
require_secret "SUPABASE_ACCESS_TOKEN" "dev"
require_secret "SUPABASE_ACCESS_TOKEN" "prod"

printf '\nMOX-392 credential names are present at their required scopes.\n'
printf 'No secret value was printed or written to disk by this helper.\n'
printf 'Tell Codex the helper completed so bounded provider preflights can run.\n'
