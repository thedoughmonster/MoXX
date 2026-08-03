# Background Work Canary Control

## Purpose

This manual-only local tool has two explicit development commands. The released
inactive command performs the approved five-minute dry-run without activating a
target. The attended recovery command dynamically authenticates due durable
work against a frozen active schedule registry, installs the same database
dead-man guard, activates the exact downstream-to-upstream target set, monitors
the bounded recovery window, and always returns the targets to inactive state.

Neither command deletes cron history, runs against production, deploys code, or
creates automation. The attended command is the only activation path. The tool emits no
credentials, SQL, provider payloads, command output, URLs, tokens, or stacks.

## Prerequisites

- Run from the exact released `dev` commit: `HEAD` must equal `origin/dev`, the
  worktree must be clean, and the linked Supabase project must be
  `xtbraqnlskmqxinjxxdn`.
- Use Node `24.14.0`, pnpm `11.7.0`, and the repository-pinned Supabase CLI
  `2.109.1` from the installed workspace.
- Released-candidate preflight requires a real repository `node_modules`, then
  verifies the exact lock-bound Linux x64 native CLI for version `2.109.1`.
  The native bytes are hashed into an owner-only snapshot, opened, unlinked,
  and executed only through its held descriptor. Provider queries never execute
  `pnpm`, a JavaScript shim, a shebang, `PATH`, or a mutable binary pathname;
  `pnpm` remains only a version preflight.
- Authenticate through the approved local CLI store; never pass a credential,
  database URL, SQL path, mode, threshold, timing, run identifier, or target.
- Confirm no other operator or process is running this canary control.

## Invocation

Setup and validation are separate process sessions. From clean released `dev`, run:

```text
pnpm local:background-work-canary-setup -- --env dev --project-ref xtbraqnlskmqxinjxxdn
```

Setup verifies the release and query identities, proves exact `/usr/bin/flock`
acquisition/conflict/release/reacquisition, runs the pinned CLI's governed `link`,
and validates CLI-owned `project-ref` plus password-free `pooler-url` as agreeing IPv4 evidence.
Optional `linked-project.json` telemetry is not authority; setup never runs SQL or changes jobs.

After setup returns `setup_ready`, start a new process session and run exactly:

```text
pnpm local:background-work-canary-control -- --env dev --project-ref xtbraqnlskmqxinjxxdn
```

For the single attended recovery authorized by issue #330, use the same setup
command and then, from a new process at the exact released SHA, run exactly:

```text
pnpm local:background-work-recovery-canary -- --env dev --project-ref xtbraqnlskmqxinjxxdn
```

The recovery command exposes no target, timing, threshold, SQL, credential,
URL, run-ID, activation-order, or rollback-order override. It activates target
11, then 2, then 3 while target 4 remains inactive. It samples every 15 seconds,
records resource evidence every 60 seconds, and deactivates 3, then 2, then 11.

Validation independently repeats the release, linkage, DNS, query, and flock checks.
It consumes the owner-only receipt once and rejects expiry, replay, change, or a
different binding before provider preparation. No other option or production use is accepted.

Owner-only setup receipts live under `~/.local/state/momi/background-work-canary/setup/`.
They retain only sanitized hashes, versions, stages, booleans, timing, release SHA,
safe exit/SQLSTATE fields, and receipt identity—never CLI output, network identity,
credentials, SQL, provider data, or stacks. A blocked setup stops after one attempt.

## Receipts and exits

Each run creates a mode-`0700` directory under the OS account home at
`~/.local/state/momi/background-work-canary/`. The directory contains the
append-only `receipt.ndjson` and, only after receipt verification, an exclusive
mode-`0600` final JSON artifact. The single stdout envelope identifies the run, final
artifact path, and SHA-256; provider output is never printed.

- Exit `0`, `inactive_dry_run_verified`: final targets are inactive, the guard
  is absent, all required checks passed, and `final.json` is verified.
- Exit `20`, `PRE_GUARD_FAILURE`: guarded work did not begin.
- Exit `30`, `RECOVERED_BUT_UNSUCCESSFUL`: rollback or dead-man recovery made
  the database safe, but the requested dry run did not complete successfully.
- Exit `40`, `MANUAL_RECONCILIATION_REQUIRED`: exact safe reconciliation or the
  final receipt could not be proved. Preserve the receipt directory unchanged.

`SIGINT` and `SIGTERM` request a bounded stop. During normal sampling they route
to recovery. During synthetic guard-heartbeat loss they never trigger a new
heartbeat or manual rollback; database-clock recovery and exact reconciliation
continue. A second signal cannot bypass that safety path.

## Database lease contract

The exact guard generation and database-clock expiry are the database lifecycle
lease. Every database mutation takes the same transaction-scoped advisory lock;
the tool intentionally holds no persistent session advisory lock. Issue #330
activation is performed only inside the exact current guard-generation and
unexpired database-lease fence in the attended orchestration.

The OS `flock` is independently monitored. Unexpected holder death is a typed
failure: before guard commitment it is pre-guard failure; after commitment it
must enter rollback or dead-man recovery. A replacement process is still fenced
by the named database guard.

The linked database role has `SELECT` but not `UPDATE` on `cron.job`, so these
transactions deliberately use no tuple-locking clause on Cron metadata reads.
Cooperative serialization remains the named guard lease, transaction-scoped
advisory lock, single writer, and exact post-mutation readback; Cron changes use
only the supported `cron.schedule`, `cron.alter_job`, and `cron.unschedule`
functions.

Bootstrap and heartbeat control transactions never scan all retained Cron
history. They anchor run evidence to the immediately verified pre-guard run ID,
use a captured upper bound for every `runid` primary-key range, and fail closed
if more than 16,384 run IDs would need inspection. A second bounded current
readback after the guard mutation rejects concurrent target starts before the
exact guard readback and commit.

## Post-run checks

For exit `0`, verify the printed final-artifact SHA-256, confirm all four fixed
targets are inactive, the guard is absent, and waiting control locks are zero.
Preserve both receipt files. The inactive dry-run is not activation evidence;
only the attended recovery artifact can satisfy issue #330's live criterion.

Stop for manual reconciliation after identity drift, a missed dead-man deadline,
unknown guard state, cleanup refusal, failed final fast/resource evidence,
receipt-chain failure, final-artifact failure, or lock-release failure. Do not
rerun while the exact guard may remain; a concurrent rerun is designed to fail.
