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
export TMPDIR="${MOMI_TMPDIR:-$(dirname "$project_dir")/.momi-openhands-tmp}"
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
local_sha="$(git rev-parse HEAD)"

git fetch --quiet origin dev:refs/remotes/origin/dev || deny \
  "Could not refresh origin/dev through shell Git. This is separate from gh auth."

[[ -f .momi/validation-receipt.json ]] || deny \
  "The committed tree has no canonical changed-check receipt."
LOCAL_SHA="$local_sha" node -e '
  const receipt = require("./.momi/validation-receipt.json")
  if (receipt.required_job !== "local-focused" || receipt.counts?.failed !== 0 ||
      receipt.identities?.head_sha !== process.env.LOCAL_SHA) process.exit(1)
' || deny "pnpm momi-check changed did not pass on the exact committed tree."

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  deny "The worktree is not clean after validation. Review, commit, and push every changed or untracked path."
fi

command -v gh >/dev/null 2>&1 || deny \
  "GitHub CLI is unavailable. Shell Git capability is unaffected, but the PR merge cannot finish."
gh auth status -h github.com >/dev/null 2>&1 || deny \
  "GitHub CLI is unauthenticated. Shell Git may still work; authenticate gh separately."

pr_number="$(gh pr view "$branch" --json number --jq '.number' 2>/dev/null || true)"
[[ "$pr_number" =~ ^[1-9][0-9]*$ ]] || deny \
  "No pull request exists for the current branch. Publish one PR to dev."
pr_state="$(gh pr view "$pr_number" --json state --jq '.state')" || deny \
  "Could not inspect the pull request state."
[[ "$pr_state" == "MERGED" ]] || deny \
  "The current branch PR must be validated, reviewed, and merged to dev."
pr_base="$(gh pr view "$pr_number" --json baseRefName --jq '.baseRefName')" || deny \
  "Could not inspect the pull request base branch."
[[ "$pr_base" == "dev" ]] || deny \
  "The pull request must target dev."
pr_draft="$(gh pr view "$pr_number" --json isDraft --jq '.isDraft')" || deny \
  "Could not inspect the pull request draft state."
[[ "$pr_draft" == "false" ]] || deny \
  "The merged pull request must have completed its ready-for-review transition."
pr_head="$(gh pr view "$pr_number" --json headRefOid --jq '.headRefOid')" || deny \
  "Could not inspect the pull request head."
[[ "$pr_head" == "$local_sha" ]] || deny \
  "The pull request head does not match the current commit."
merge_sha="$(gh pr view "$pr_number" --json mergeCommit --jq '.mergeCommit.oid // ""')" || deny \
  "Could not inspect the pull request merge commit."
[[ -n "$merge_sha" ]] || deny "The pull request has no recorded merge commit."
git merge-base --is-ancestor "$merge_sha" origin/dev || deny \
  "The pull request merge commit is not present on origin/dev."
review_decision="$(gh pr view "$pr_number" --json reviewDecision --jq '.reviewDecision // ""')" || deny \
  "Could not inspect the pull request review decision."
[[ "$review_decision" != "CHANGES_REQUESTED" ]] || deny \
  "The pull request has an unresolved changes-requested review."

repository="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')" || deny \
  "Could not resolve the GitHub repository."
owner="${repository%%/*}"
name="${repository#*/}"
unresolved_threads="$(gh api graphql --paginate \
  -f query='query($owner:String!,$name:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$endCursor){nodes{isResolved}pageInfo{hasNextPage endCursor}}}}}' \
  -F owner="$owner" -F name="$name" -F number="$pr_number" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length' \
  | awk '{ total += $1 } END { print total + 0 }')" || deny \
  "Could not inspect pull request review threads."
[[ "$unresolved_threads" == "0" ]] || deny \
  "The pull request still has unresolved review threads."

pr_body="$(gh pr view "$pr_number" --json body --jq '.body')" || deny \
  "Could not inspect the pull request metadata."
owning_count="$(printf '%s\n' "$pr_body" | grep -Ec '^Owning issue: #[1-9][0-9]*$' || true)"
disposition_count="$(printf '%s\n' "$pr_body" | grep -Ec '^Disposition: (partial|complete)$' || true)"
[[ "$owning_count" == "1" && "$disposition_count" == "1" ]] || deny \
  "PR metadata must contain exactly one Owning issue: #<number> and one Disposition: partial|complete line."
issue_number="$(printf '%s\n' "$pr_body" | sed -nE 's/^Owning issue: #([1-9][0-9]*)$/\1/p')"
disposition="$(printf '%s\n' "$pr_body" | sed -nE 's/^Disposition: (partial|complete)$/\1/p')"
issue_state="$(gh issue view "$issue_number" --json state --jq '.state')" || deny \
  "Could not inspect the pull request owning issue."
if [[ "$disposition" == "partial" ]]; then
  [[ "$issue_state" == "OPEN" ]] || deny \
    "A partial delivery must leave its owning GitHub issue open."
else
  [[ "$issue_state" == "CLOSED" ]] || deny \
    "A complete delivery must close its owning GitHub issue through the ledger."
fi

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
  deny "Both validate-final and the issue-ledger validation must succeed before merge."
fi

exit 0
