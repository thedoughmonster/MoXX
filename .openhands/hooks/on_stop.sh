#!/usr/bin/env bash
set -Eeuo pipefail

deny() {
  printf '{"decision":"deny","reason":"%s"}\n' "$1"
  exit 2
}

project_dir="${OPENHANDS_PROJECT_DIR:-$PWD}"
cd "$project_dir" || deny "The OpenHands project directory is unavailable."
project_dir="$PWD"
export GH_CONFIG_DIR="${GH_CONFIG_DIR:-${HOME}/.openhands/gh}"
export TMPDIR="${project_dir}/.momi/tmp"
mkdir -p "$TMPDIR" || deny "The repository-local temporary directory is unavailable."
chmod 700 "$TMPDIR" || deny "The repository-local temporary directory cannot be secured."

expected_node="$(tr -d '[:space:]' < .node-version)"
actual_node="$(node -p 'process.versions.node' 2>/dev/null || true)"
[[ "$actual_node" == "$expected_node" ]] || deny \
  "MoMi completion requires Node ${expected_node}; activate .openhands/setup.sh."

command -v pnpm >/dev/null 2>&1 || deny \
  "pnpm is unavailable; rerun the OpenHands repository setup."
command -v git >/dev/null 2>&1 || deny "Shell Git is unavailable."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || deny \
  "The current directory is not a Git worktree."

branch="$(git branch --show-current)"
case "$branch" in
  ""|dev|prod|main) deny \
    "Finish only from an isolated feature branch; dev, prod, and main are protected." ;;
esac

git fetch --quiet origin dev:refs/remotes/origin/dev || deny \
  "Could not refresh origin/dev through shell Git. This is separate from gh auth."
git merge-base --is-ancestor origin/dev HEAD || deny \
  "The feature branch is not based on current origin/dev; reconcile the base first."

if ! pnpm momi-check changed; then
  deny "pnpm momi-check changed failed. Fix the issue-scoped validation failure."
fi

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  deny "The worktree is not clean after validation. Review, commit, and push every changed or untracked path."
fi

command -v gh >/dev/null 2>&1 || deny \
  "GitHub CLI is unavailable. Shell Git capability is unaffected, but PR handoff cannot finish."
gh auth status -h github.com >/dev/null 2>&1 || deny \
  "GitHub CLI is unauthenticated. Shell Git may still work; authenticate gh separately."

local_sha="$(git rev-parse HEAD)"
remote_sha="$(git ls-remote --heads origin "$branch" | awk 'NR == 1 { print $1 }')"
[[ -n "$remote_sha" && "$remote_sha" == "$local_sha" ]] || deny \
  "The current commit is not the pushed remote feature-branch head."

pr_number="$(gh pr view "$branch" --json number --jq '.number' 2>/dev/null || true)"
[[ "$pr_number" =~ ^[1-9][0-9]*$ ]] || deny \
  "No pull request exists for the current branch. Publish one draft PR to dev."
pr_state="$(gh pr view "$pr_number" --json state --jq '.state')" || deny \
  "Could not inspect the pull request state."
[[ "$pr_state" == "OPEN" ]] || deny \
  "The current branch PR is not open."
pr_base="$(gh pr view "$pr_number" --json baseRefName --jq '.baseRefName')" || deny \
  "Could not inspect the pull request base branch."
[[ "$pr_base" == "dev" ]] || deny \
  "The pull request must target dev."
pr_draft="$(gh pr view "$pr_number" --json isDraft --jq '.isDraft')" || deny \
  "Could not inspect the pull request draft state."
[[ "$pr_draft" == "true" ]] || deny \
  "The initial pull request must remain draft for human review."
pr_head="$(gh pr view "$pr_number" --json headRefOid --jq '.headRefOid')" || deny \
  "Could not inspect the pull request head."
[[ "$pr_head" == "$local_sha" ]] || deny \
  "The pull request head does not match the current commit."

pr_body="$(gh pr view "$pr_number" --json body --jq '.body')" || deny \
  "Could not inspect the pull request metadata."
owning_count="$(printf '%s\n' "$pr_body" | grep -Ec '^Owning issue: #[1-9][0-9]*$' || true)"
disposition_count="$(printf '%s\n' "$pr_body" | grep -Ec '^Disposition: (partial|complete)$' || true)"
[[ "$owning_count" == "1" && "$disposition_count" == "1" ]] || deny \
  "PR metadata must contain exactly one Owning issue: #<number> and one Disposition: partial|complete line."
issue_number="$(printf '%s\n' "$pr_body" | sed -nE 's/^Owning issue: #([1-9][0-9]*)$/\1/p')"
issue_state="$(gh issue view "$issue_number" --json state --jq '.state')" || deny \
  "Could not inspect the pull request owning issue."
[[ "$issue_state" == "OPEN" ]] || deny \
  "The PR owning issue must be an open GitHub issue for the delivery ledger."

if ! gh pr checks "$pr_number" --watch --fail-fast --interval 10; then
  deny "Required PR checks failed or could not be observed. Inspect the actual GitHub failure."
fi
checks_json="$(gh pr checks "$pr_number" --json name,state,workflow)" || deny \
  "Could not inspect the required pull request check results."
if ! CHECKS_JSON="$checks_json" node -e '
  const checks = JSON.parse(process.env.CHECKS_JSON || "[]")
  const passed = (name, workflow) => checks.some((check) =>
    check.name === name && check.workflow === workflow && check.state === "SUCCESS")
  if (!passed("validate-final", "Validate backend") ||
      !passed("validate", "Enforce issue ledger")) process.exit(1)
'; then
  deny "Both validate-final and the issue-ledger validation must succeed before handoff."
fi

exit 0
