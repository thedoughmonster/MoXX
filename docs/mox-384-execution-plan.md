# MOX-384 execution plan

## Outcome

Deliver one product repository, one stock Symphony scheduler, and one external
watchdog without deleting or rewriting any existing authority during the
cutover.

The target boundaries are:

- `thedoughmonster/MoXX`
  - `MoXi/`: UI and browser presentation
  - `MoMi/`: backend services, migrations, and contracts
- `thedoughmonster/openai-symphony`
  - upstream-stock Elixir scheduler
  - VPS deployment configuration and `WORKFLOW.md`
- `thedoughmonster/symphony-watchdog`
  - token and turn accounting
  - Linear availability circuit
  - Parked and Blocked queue policy
  - admission decisions and dashboard events

Linear umbrella: [MOX-384](https://linear.app/moxx-workboard/issue/MOX-384)

## Current state

- `openai-symphony.service` is intentionally inactive. Do not restart it before
  MOX-394. It is also disabled, and the completed MOX-395 validation left it
  stopped with no Beam, Elixir, Mix, or Symphony process.
- MOX-396 restored only `symphony/elixir/` to the exact committed stock tree
  after explicit operator authorization. The verified MOX-393 recovery package
  remains untouched; non-Elixir working-tree customizations remain preserved.
- MOX-395 passed the stock scheduler build, test, lint, static-analysis, release
  artifact, service-identity SSH clone, and one-query Linear smoke contracts
  without starting Symphony.
- A local MoXX draft exists at `/home/ubuntu/MoXX`.
- Full source histories have been imported without squashing.
- Root monorepo governance and automation are complete at commit
  `4399b13003b55a9879f4b39359bb8503e789a7fb`: active workflows now live at the
  repository root, product checks retain separate toolchains, deployment paths
  and artifacts are product-prefixed, and cross-product changes require an
  explicit interface statement.
- MOX-389 layout adaptations are committed at
  `f3870d1ea5e026c5b7622e90e15dee644f19c6a2`. After explicit loopback and
  dependency-access authorization, both product contracts pass in full. MoXi
  passes lint, types, 29 unit tests, 20 Playwright tests, its build, and both
  Cloudflare dry-runs. MoMi passes all nine hard-stop checks, all Edge Functions,
  and 1,422 tests against the exact local dev/prod histories. Exact evidence is
  in `mox-389-validation-receipt.md`; the completion evidence is committed at
  `78a8769ac78c0c889d3c1621a0e1fde1f557b4f6`, and the issue is Done.
- The local watchdog foundation exists at `/home/ubuntu/symphony-watchdog` and
  passes its typecheck, fixtures, lease, and loopback health smoke tests.
- The original MoMi and MoXi repositories have not been modified.
- The public MoXX GitHub repository exists at
  `https://github.com/thedoughmonster/MoXX`. Its default branch is `dev`; exact
  accepted `dev`, `prod`, and ported MOX-348 histories are published. Native
  `dev` and `prod` rulesets are active, cannot be bypassed by the owner, and
  directly reject unvalidated pushes.
- GitHub SSH access works. MOX-395 replaced the stale global Git SSH executable
  path with `/usr/bin/ssh`, preserved its options and file mode, and retained a
  hash-addressed backup of the prior configuration.
- GitHub CLI authentication is valid as `thedoughmonster` after a device-flow
  renewal, and the host uses SSH Git transport. GitHub's current account plan
  cannot protect a private repository, so the operator explicitly authorized a
  public MoXX repository. A redacted full-history audit classified every scanner
  candidate as a synthetic test marker, digest, identifier, or fixture value;
  no credential or sensitive tracked filename was found. Publication,
  repository governance, and the stopped-service Symphony mapping are directly
  verified. Linear is now the sole active work-item authority: GitHub Issues are
  disabled in MoXX, active GitHub-Issues workflows are removed, and the debt
  registry keys accepted findings to Linear issues including new MOX-406 for
  the former #572 remediation scope. This authority transition landed through
  PR #19 as `0985a25a7c97ac2d50163602a976cb566f5404d8`. MOX-392 remains In
  Progress: all four placements are present by name and the Cloudflare and dev
  Supabase GET-only preflights passed, but the protected `prod` environment
  rejected the dev-ref run before steps. The immutable `prod` ref predates the
  preflight workflow, so its credential path is not directly evidenced. No
  active value was exposed; repository variables remain empty. Exact evidence
  is in `mox-392-publication-receipt.md`.

## Native dependency graph

```text
MOX-384
├── MOX-386  MoXX monorepo
│   └── MOX-391 → MOX-388 → MOX-389 → MOX-392 → MOX-390
├── MOX-385  Stock Symphony Elixir
│   └── MOX-393 → MOX-396 → MOX-395 ───────────────┐
└── MOX-387  External watchdog                     │
    └── MOX-397 → MOX-405 ┬→ MOX-403 → MOX-398 ─┐ │
                           └→ MOX-402 → MOX-399 ─┼→ MOX-400
                                             MOX-402 ┘      │
                                        MOX-403 ────────────┼→ MOX-404
                                                           └→ MOX-401

MOX-392 + MOX-395 + MOX-401 → MOX-394 integrated canary
```

MOX-391, MOX-388, MOX-389, MOX-393, MOX-396, MOX-395, and MOX-397 are Done.
MOX-392 remains the active product-chain leaf. Publication, mapping, Linear
authority, and all four names-only placements are complete, but direct prod
credential validation is blocked by the protected immutable prod ref.
MOX-390 remains blocked by MOX-392. MOX-405 is the next executable leaf in the
overall native dependency graph because its sole blocker, MOX-397, is Done.
Remaining implementation leaves are in Todo, and native blockers prevent later
leaves from being mistaken for ready work. None has `ready-package`.

## Workstream A: MoXX monorepo

Parent: [MOX-386](https://linear.app/moxx-workboard/issue/MOX-386)

1. [MOX-391](https://linear.app/moxx-workboard/issue/MOX-391) imports and
   verifies full source histories. The local import and tree verification are
   already complete; its manifest is in `repository-migration-manifest.md`.
2. [MOX-388](https://linear.app/moxx-workboard/issue/MOX-388) made root CI,
   hooks, Dependabot, governance, and deployment path routing monorepo-aware at
   commit `4399b13003b55a9879f4b39359bb8503e789a7fb`. Verified evidence includes
   14 active root workflows, YAML/JSON parsing, static authority validation,
   product-routing fixtures, and monorepo-aware hook fixtures.
3. [MOX-389](https://linear.app/moxx-workboard/issue/MOX-389) is Done.
   Layout adaptations are committed at `f3870d1ea5e026c5b7622e90e15dee644f19c6a2`;
   both full product contracts, dev/prod identity checks, root routing, migration
   order, backend impact planning, UI build equivalence, and provider dry-runs
   pass. Completion evidence is committed at
   `78a8769ac78c0c889d3c1621a0e1fde1f557b4f6`; see
   `mox-389-validation-receipt.md`.
4. [MOX-392](https://linear.app/moxx-workboard/issue/MOX-392) created the
   operator-authorized public remote, published the verified histories,
   protected `dev` and `prod`, retained the host Git transport fix outside
   application code, and updated repository mappings while Symphony remained
   stopped. GitHub Issues are inactive and Linear is the sole work authority.
   PR #19 landed that transition at
   `0985a25a7c97ac2d50163602a976cb566f5404d8` with authoritative backend,
   CodeQL, Linear-mapping, and monorepo checks.
   It remains In Progress. Repository secrets `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN` and environment secret `SUPABASE_ACCESS_TOKEN` in
   both `dev` and `prod` are present by name. The GET-only Cloudflare and dev
   Supabase preflights passed, but the prod environment rejected the dev-ref
   run before steps and its immutable ref lacks the preflight workflow; see
   `mox-392-publication-receipt.md`.
5. [MOX-390](https://linear.app/moxx-workboard/issue/MOX-390) inventories and
   dispositions active source-repository work before adding reversible
   tombstones. It deletes nothing.

Branch policy:

- `dev` is the development and agent base.
- `prod` retains guarded production promotion.
- MoXi preview deploys from `dev`; MoXi production deploys from `prod`.
- MoMi retains its existing exact-receipt release rules inside `MoMi/`.
- UI and backend changes remain independently reviewable.

## Workstream B: stock Symphony Elixir

Parent: [MOX-385](https://linear.app/moxx-workboard/issue/MOX-385)

1. [MOX-393](https://linear.app/moxx-workboard/issue/MOX-393) creates a
   hash-verified, secret-free recovery package for the dirty Elixir tree.
2. [MOX-396](https://linear.app/moxx-workboard/issue/MOX-396) restores only
   `elixir/` from committed stock and proves non-Elixir files are unchanged.
   This completed after explicit operator authorization; the recovery package
   and non-Elixir customizations remain preserved.
3. [MOX-395](https://linear.app/moxx-workboard/issue/MOX-395) builds and tests
   stock Elixir and verifies the VPS service boundary while the service remains
   stopped. It is Done; `make all` passed 296 tests with 0 failures, and the
   release/SSH/Linear smoke evidence was recorded without a restart.
4. [MOX-394](https://linear.app/moxx-workboard/issue/MOX-394) is the only leaf
   allowed to restart Symphony. It joins stock Elixir, MoXX mapping, and the
   proven watchdog in one controlled canary.

The rollback must never use a repository-wide reset, clean, or stash. The
isolated `CODEX_HOME`, workflow, service drop-ins, environment files, and
external monitor stay outside the Elixir restoration.

## Workstream C: external watchdog

Parent: [MOX-387](https://linear.app/moxx-workboard/issue/MOX-387)

1. [MOX-397](https://linear.app/moxx-workboard/issue/MOX-397) creates the Node
   24/TypeScript runtime and transactional SQLite ledger. The clean local
   foundation is complete at commit `916eb91`.
2. [MOX-405](https://linear.app/moxx-workboard/issue/MOX-405) publishes that
   exact foundation to a private, protected remote and adds required CI. It
   does not install or activate the runtime.
3. [MOX-403](https://linear.app/moxx-workboard/issue/MOX-403) ingests only the
   isolated Symphony Codex JSONL and calculates cumulative usage and velocity.
4. [MOX-398](https://linear.app/moxx-workboard/issue/MOX-398) evaluates token
   and turn budgets and authorized `/budget` overrides without resetting usage.
5. [MOX-402](https://linear.app/moxx-workboard/issue/MOX-402) receives verified
   Linear webhooks and owns the crash-safe mutation outbox.
6. [MOX-399](https://linear.app/moxx-workboard/issue/MOX-399) implements the
   one-minute quota circuit, GraphQL `RATELIMITED` handling, and least-privilege
   graceful stop of only `openai-symphony.service`.
7. [MOX-400](https://linear.app/moxx-workboard/issue/MOX-400) adds Parked and
   Blocked transitions plus the fail-closed local admission hook.
8. [MOX-404](https://linear.app/moxx-workboard/issue/MOX-404) moves worker,
   model, reasoning, token, turn, hierarchy, review, and circuit events into the
   actual dashboard issue rows through a watchdog WebSocket.
9. [MOX-401](https://linear.app/moxx-workboard/issue/MOX-401) proves all
   control paths with fixtures and a contained watchdog canary without starting
   Symphony.

SQLite is authoritative for run accounting, cursors, budgets, overrides,
pause state, control actions, and pending Linear projections. Linear remains
the human workflow and projection surface.

## Execution waves

### Wave 1: safe foundations

Run independently:

- MOX-391: repository-history verification
- MOX-393: dirty-Elixir recovery package
- MOX-397: watchdog repository and database foundation

### Wave 2: local implementation

- MOX-388 after MOX-391
- MOX-396 after MOX-393 and explicit operator authorization
- MOX-405 after MOX-397

### Wave 3: policy and validation

- MOX-389 after MOX-388
- MOX-395 after MOX-396
- MOX-403 and MOX-402 after MOX-405
- MOX-398 after MOX-403
- MOX-399 after MOX-402

### Wave 4: integrations

- MOX-392 after MOX-389
- MOX-400 after MOX-398, MOX-399, and MOX-402
- MOX-404 after MOX-400 and MOX-403

### Wave 5: proof and cutover

- MOX-401 after MOX-404
- MOX-394 after MOX-392, MOX-395, and MOX-401
- MOX-390 after MOX-392 and after the operator accepts the integrated evidence

## Manual execution contract

These issues do not depend on Symphony dispatch. A human or manually started
agent can execute a leaf by:

1. Reading the leaf, its parent, and every native blocker.
2. Confirming blockers are Done and the named repository/base commit is still
   current.
3. Creating one isolated feature branch or worktree for the leaf.
4. Preserving every non-goal and rollback boundary from the issue.
5. Linking the exact commit/PR, validation receipt, and operational evidence.
6. Marking the leaf Done only when every acceptance criterion is directly
   evidenced.

No agent should infer permission to deploy, restart Symphony, create provider
secrets, or tombstone repositories from a neighboring issue.

## Recovery boundaries

- Repository consolidation is reversible until source tombstones are applied;
  even then, no source history is deleted.
- Elixir restoration is reversible from the audit package in an isolated
  checkout, not by re-dirtying the service worktree.
- Watchdog derived state is replayable from immutable JSONL and the Linear
  delivery/outbox ledger.
- Linear outages close local admission first. If Linear cannot accept Parked or
  Blocked changes, the quota circuit stops Symphony gracefully.
- Authentication failures never trigger automatic restart.
