# MOX-392 publication receipt

Status: in progress; publication and mapping complete, provider credential gate open

## Published identity

- Repository: `https://github.com/thedoughmonster/MoXX`
- Visibility: public, by explicit operator amendment to MOX-392
- Default branch: `dev`
- Initial development publication tip: `8543422081f2268dd46d349e1f58c4522ca2ec20`
- Published production tip: `3e6a4f2c1a896c69998f6a658f2a38225abfbd59`
- Published MOX-348 branch: `508b7fb663579f9257295581c56b2b7735602f6c`
- Accepted development tree: `30412b2d6d1c733fd75549b419a622310caf753d`
- Accepted production tree: `07cb28ab15aa0d3bd1e0fe3ee8988aa6afe4a820`

The history-only merge `8543422081f2268dd46d349e1f58c4522ca2ec20`
joins the accepted production import into development ancestry. Its tree is
exactly the accepted development tree, so no product file changed and imported
history was not rewritten. There were no accepted tags to publish.

## Authorization and disclosure gate

The GitHub account cannot enable native protection for a private repository on
its current plan. The operator explicitly authorized public visibility for
`thedoughmonster/MoXX` only; neither source repository was made public or
otherwise changed.

Before publication, official Gitleaks `8.30.1` scanned all reachable history.
The redacted scan covered 438 commits and classified 80 candidates as synthetic
test markers, digests, internal identifiers, cron keys, or test UUIDs. Neither
malformed PEM test marker parsed as a private key, no candidate matched a known
provider-token prefix or JWT shape, and a history-wide filename inventory found
no tracked credential or private-key file. No history rewrite was required.

## Repository governance

- Repository settings retain merge, squash, and rebase merges, disable
  auto-merge and automatic branch deletion, retain projects, and disable wiki,
  discussions, and GitHub Issues.
- `dev` is protected by repository ruleset `21423436` (`Protect dev`). Changes
  require a pull request, resolved review conversations, and both universal
  GitHub Actions checks. The sole owner is not deadlocked by a mandatory
  self-review.
- `prod` is protected by repository ruleset `21423602` (`Protect prod`). Only
  fast-forward commits carrying both universal checks can advance it. This
  retains the exact-commit `dev` to `prod` promotion contract without granting
  a direct-push bypass.
- Both rulesets prohibit deletion and force pushes, require
  `monorepo-routing` and `monorepo-static-config` from GitHub Actions integration
  `15368`, and report `current_user_can_bypass: never`.
- Third-party Actions must be pinned by immutable SHA. Default workflow-token
  permissions are read-only and cannot approve pull requests. The first live
  CodeQL run exposed two inherited mutable `@v4` references; both are now pinned
  to the verified CodeQL `v4.37.8` commit, and root validation rejects any future
  unpinned active action.
- Dependabot vulnerability alerts, automated security fixes, and private
  vulnerability reporting are enabled.
- The `dev`, `prod`, and `prod-promotion` environments match the source branch
  policies: `dev`, `prod`, and `dev`, respectively.
- Pull requests name exactly one authoritative `MOX-…` Linear issue, and that
  identifier must equal the sole Linear identifier in the head branch. Missing,
  mismatched, or ambiguous mappings fail closed without duplicating work into a
  GitHub issue ledger.
- Linear is the sole work-item authority. The active GitHub-Issues triage and
  remote debt-issue workflows were removed, the remaining PR check is named
  `linear-issue-mapping.yml`, and root validation rejects any active workflow
  that requests GitHub Issues authority.
- The debt lifecycle registry now keys its 82 accepted fingerprints to
  MOX-20, MOX-22, MOX-23, and
  [MOX-406](https://linear.app/moxx-workboard/issue/MOX-406). Legacy GitHub
  issue numbers remain only in historical provenance. MOX-406 preserves the
  exact three-fingerprint archive/evaluation remediation formerly recorded in
  GitHub #572.
- Root CODEOWNERS, Dependabot, workflows, and path-routing configuration are
  present in the published tree.

## Direct verification

- Before the governance pull request, a fresh `dev` clone resolved remote `dev`
  to `8543422081...` and tree
  `30412b2d...`.
- A separate fresh `prod` clone resolved to `3e6a4f2c...` and tree
  `07cb28ab...`.
- Remote `mox-348-centralize-ui-readiness` resolved to `508b7fb6...`.
- An isolated empty commit pushed directly to `dev` was rejected with GH013:
  a pull request and two required checks were missing.
- The same unvalidated fast-forward pushed directly to `prod` was rejected with
  GH013 because both required checks were missing.
- Neither protection probe changed a remote ref.
- Root automation validation discovers the 12 active workflows after retiring
  the two GitHub-Issues authorities, and both root routing/static-config tests
  pass.
- The focused issue-mapping validation passes positive, missing, mismatched, and
  ambiguous branch cases. PR `#16` is linked directly on Linear MOX-392.
- A live settings read reports `hasIssuesEnabled: false`, public visibility,
  and default branch `dev`. A names-only repository-variable read is empty
  after removing the retired model-gateway triage variable.
- Names-only reads of repository secrets and both `dev` and `prod` environment
  secrets are empty; no value was requested or exposed during verification.
- PR #19 head `d6fd995b57819562f01a963d7427791954c23d8a` passed the
  Linear-mapping check, CodeQL, both monorepo checks, and the 5m38s authoritative
  backend final gate. It squash-merged as
  `0985a25a7c97ac2d50163602a976cb566f5404d8`.
- The only failed PR check was the non-required base-branch debt verifier being
  removed: it attempted GitHub issue lookup for `#MOX-20` and returned Not
  Found. The merged tree contains no such workflow. Exact post-merge
  `monorepo-routing`, `monorepo-static-config`, and CodeQL runs succeeded on
  `0985a25a7c97ac2d50163602a976cb566f5404d8`.

## Repository mapping and credentials

Symphony remains stopped and disabled. Only the existing dirty deployment
workflow's repository-routing fields changed:

- Linear routing label: `moxx` (a unique team label created for the monorepo)
- Repository context: `thedoughmonster/MoXX`
- Clone target: SSH, depth one, explicit `dev`

The workflow parses successfully in a transient unit using the exact stopped
service identity, environment file, `HOME`, `PATH`, and isolated `CODEX_HOME`.
That boundary cloned `dev` non-interactively. One bounded Linear viewer query
returned HTTP 200, a present viewer, and zero GraphQL errors without printing
the identity or token. The corrected global SSH command still resolves
`/usr/bin/ssh`; it does not depend on `/opt/agent-tools/bin/ssh`.

## Remaining external gate

The public repository has no provider secret values. Existing GitHub secret
values cannot be read back for safe copying, so no empty, placeholder, or
fabricated credential was created. The former model-gateway repository variable
and triage secret are not required: they served only the retired active GitHub
Issues triage workflow. The same gateway URL name remains valid Supabase runtime
configuration for communications services and is outside this GitHub Actions
credential gate.

Run `scripts/provision-mox-392-credentials.sh` from a trusted interactive
terminal to finish this gate. The helper prompts invisibly for four write-only
placements, pipes each value directly to GitHub CLI at its repository or
environment scope, and verifies names without reading values back. It rejects
empty input and never writes a secret value to disk or prints one:

- repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`;
- environment secret `SUPABASE_ACCESS_TOKEN` in `dev`; and
- environment secret `SUPABASE_ACCESS_TOKEN` in `prod`.

MOX-392 therefore remains In Progress until an operator securely re-enters the
four required secret placements. The required names are inventoried without
their values in the Linear workpad. All other publication, protection, mapping,
clone, and credential-path criteria are directly verified.

## Preservation

- Source MoMi and MoXi repositories and all their settings are unchanged.
- The temporary GitHub mirror issue created while diagnosing the inherited
  ledger was closed as not planned; Linear MOX-392 remains the sole authority.
- Source repositories remain authoritative until MOX-390 performs the
  separately governed cutover and reversible tombstoning work.
- No deployment or provider configuration changed.
- Symphony was not installed, enabled, started, or restarted.
- The stock `symphony/elixir/` tree and all recovery packages remain untouched.
