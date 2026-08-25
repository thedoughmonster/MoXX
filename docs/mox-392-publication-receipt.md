# MOX-392 publication receipt

Status: in progress; credential placement complete, prod preflight blocked

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
- Root automation validation discovers the 13 governed workflow files after retiring
  the two GitHub-Issues authorities, and both root routing/static-config tests
  pass.
- The focused issue-mapping validation passes positive, missing, mismatched, and
  ambiguous branch cases. PR `#16` is linked directly on Linear MOX-392.
- A live settings read reports `hasIssuesEnabled: false`, public visibility,
  and default branch `dev`. A names-only repository-variable read is empty
  after removing the retired model-gateway triage variable.
- Names-only reads report repository secrets `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN`, `SUPABASE_ACCESS_TOKEN` in `dev`, and
  `SUPABASE_ACCESS_TOKEN` in `prod`. Repository variables remain empty.
  Neither `MOMI_MODEL_EXECUTION_GATEWAY_URL` nor
  `MOMI_MODEL_GATEWAY_TRIAGE_SECRET` was restored for GitHub Actions.
- No active credential value was printed, persisted, or included in GitHub or
  Linear evidence.
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

## Credential gate evidence and remaining blocker

The operator authorized creation of bounded provider credentials and direct
transfer through the trusted interactive helper. The successful helper run
accepted the exact `MOX-392 SECRETS` confirmation, disabled terminal echo before
each value, and completed all four write-only placements:

- repository secret `CLOUDFLARE_ACCOUNT_ID`;
- repository secret `CLOUDFLARE_API_TOKEN`;
- environment secret `SUPABASE_ACCESS_TOKEN` in `dev`; and
- environment secret `SUPABASE_ACCESS_TOKEN` in `prod`.

Both environment placements received the same single Supabase token input.
Names-only GitHub API reads confirm all four destinations and an empty
repository-variable inventory without attempting to read a value back.

The active credentials passed the canonical root GET-only preflights:

- Cloudflare workflow `Verify Cloudflare credential scope`, run
  `32864808511`, job `97857332581` (`verify-read-authority`), completed
  successfully at `cf276c5ce132b97b76e04a281e51090e29316e46`. Its bounded
  token, Worker-script, account, zone, route, and DNS inventory reads all
  succeeded; no deploy or provider mutation ran.
- Supabase workflow `Verify Supabase credential scope`, run `32865650852`, job
  `97860152707` (`verify-read-authority-dev`), completed successfully at
  `7dd43968859548d464a8cb1c3c40d8d2e136145f`. The token authenticated and
  read the exact configured target metadata by project/branch reference; no
  database, function, deployment, or provider mutation ran.
- A prod-scoped dispatch, run `32865670614`, job `97860212152`, was rejected by
  the existing environment branch policy before runner allocation and has zero
  steps. GitHub's exact conclusion was that branch `dev` is not allowed for the
  `prod` environment. This proves the protection is enforced but does not
  validate the credential from the `prod` environment:
  the helper placed the same already-validated Supabase value in both
  environments, and names-only reads confirm the `prod` destination. The
  immutable `prod` commit predates the preflight workflow and remains
  `3e6a4f2c1a896c69998f6a658f2a38225abfbd59`; its protection was not weakened.
  A prod-ref dispatch cannot load the workflow because that immutable commit
  predates it. Therefore the prod credential path is not directly evidenced,
  and MOX-392 remains In Progress. Completing it requires new authority to add
  the GET-only preflight to `prod` through its protected promotion contract;
  the environment policy must not be weakened or bypassed.

PR #21 introduced the two registered read-only preflights and merged as
`cf276c5ce132b97b76e04a281e51090e29316e46`. PR #22 corrected the Supabase
project-reference field and merged as
`0887cecd42cb27665f6ee8cf01930795dcd01170`. PR #23 replaced list inventory
with the exact-target GET-only read and merged as
`7dd43968859548d464a8cb1c3c40d8d2e136145f`. All three passed the Linear
ownership and monorepo routing/static-config gates before merge.

Two earlier generated credential attempts were revoked before final placement
after local handling failures. Provider inventory confirmed their revocation.
The fresh active replacements used for the successful helper run and
preflights were not exposed. No value appears in this receipt, GitHub output,
or the Linear workpad.

## Preservation

- Source MoMi and MoXi repositories and all their settings are unchanged.
- The temporary GitHub mirror issue created while diagnosing the inherited
  ledger was closed as not planned; Linear MOX-392 remains the sole authority.
- Source repositories remain authoritative until MOX-390 performs the
  separately governed cutover and reversible tombstoning work.
- No deployment or provider configuration changed.
- Symphony was not installed, enabled, started, or restarted.
- The stock `symphony/elixir/` tree and all recovery packages remain untouched.
