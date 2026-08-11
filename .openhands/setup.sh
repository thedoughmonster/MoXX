#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="${OPENHANDS_PROJECT_DIR:-$PWD}"
cd "$project_dir"
project_dir="$PWD"
export GH_CONFIG_DIR="${GH_CONFIG_DIR:-${HOME}/.openhands/gh}"
mkdir -p "$GH_CONFIG_DIR"
export TMPDIR="${MOMI_TMPDIR:-$(dirname "$project_dir")/.momi-openhands-tmp}"
mkdir -p "$TMPDIR"
chmod 700 "$TMPDIR"

expected_node="$(tr -d '[:space:]' < .node-version)"
expected_pnpm="$(node -e "const p=require('./package.json');process.stdout.write(p.packageManager.split('@').at(-1))" 2>/dev/null || printf '11.7.0')"
platform="linux-x64"
archive="node-v${expected_node}-${platform}.tar.xz"
cache_root="${HOME}/.openhands/cache/momi-openhands/node"
node_home="${cache_root}/node-v${expected_node}-${platform}"

if [[ ! -x "${node_home}/bin/node" ]]; then
  download_dir="$(mktemp -d)"
  trap 'rm -rf "$download_dir"' EXIT
  base_url="https://nodejs.org/dist/v${expected_node}"
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 "${base_url}/${archive}" \
    --output "${download_dir}/${archive}"
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 "${base_url}/SHASUMS256.txt" \
    --output "${download_dir}/SHASUMS256.txt"
  grep "  ${archive}$" "${download_dir}/SHASUMS256.txt" \
    > "${download_dir}/SHASUMS256.selected"
  (cd "$download_dir" && sha256sum --check SHASUMS256.selected)
  mkdir -p "$cache_root"
  tar -xJf "${download_dir}/${archive}" -C "$cache_root"
  rm -rf "$download_dir"
  trap - EXIT
fi

export PATH="${node_home}/bin:${PATH}"
export COREPACK_HOME="${HOME}/.openhands/cache/node/corepack"
mkdir -p "$COREPACK_HOME"
actual_node="$(node --version)"
if [[ "$actual_node" != "v${expected_node}" ]]; then
  printf 'Expected Node v%s, found %s\n' "$expected_node" "$actual_node" >&2
  exit 1
fi

corepack enable >/dev/null
corepack prepare "pnpm@${expected_pnpm}" --activate >/dev/null
actual_pnpm="$(pnpm --version)"
if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
  printf 'Expected pnpm %s, found %s\n' "$expected_pnpm" "$actual_pnpm" >&2
  exit 1
fi
pnpm install --frozen-lockfile

printf '\nMoMi OpenHands capability preflight\n'
printf '%-28s %s\n' 'Execution harness' 'OpenHands repository setup active'
printf '%-28s %s\n' 'Repository directory' "$project_dir"
printf '%-28s %s\n' 'Node runtime' "$actual_node"
printf '%-28s %s\n' 'Package manager' "pnpm ${actual_pnpm}"

remote_url="$(git remote get-url origin 2>/dev/null || true)"
if git ls-remote --exit-code origin HEAD >/dev/null 2>&1; then
  printf '%-28s %s\n' 'Shell Git remote read' 'available'
else
  printf '%-28s %s\n' 'Shell Git remote read' 'unavailable'
fi
case "$remote_url" in
  git@*|ssh://*) printf '%-28s %s\n' 'Git SSH transport' 'configured' ;;
  *) printf '%-28s %s\n' 'Git SSH transport' 'not configured for origin' ;;
esac
if command -v gh >/dev/null 2>&1 && gh auth status -h github.com >/dev/null 2>&1; then
  printf '%-28s %s\n' 'GitHub CLI auth' 'available'
else
  printf '%-28s %s\n' 'GitHub CLI auth' 'unavailable (Git may still work)'
fi
printf '%-28s %s\n' 'Linear connector auth' 'verify native plugin tools in the OpenHands session'
printf '%-28s %s\n' 'GitHub MCP auth' 'separate; optional when shell Git and gh work'
