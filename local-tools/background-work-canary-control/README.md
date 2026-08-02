# Background Work Canary Control

## Purpose

This manual-only local tool performs the approved development dry-run for the
paused background-work schedules. It verifies the released `dev` checkout,
holds one lifecycle lock, installs a database dead-man guard, samples the fixed
inactive targets for five minutes, deliberately stops guard heartbeats, waits
for database-clock recovery, removes the exact guard, and verifies the final
inactive state.

It does not activate issue #330, resume target schedules, delete cron history,
run against production, deploy code, or create automation. The tool emits no
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
- Authenticate the pinned Supabase CLI through its approved local credential
  store. Do not pass a credential, database URL, SQL path, mode, threshold,
  timing, run identifier, or target on the command line.
- Confirm no other operator or process is running this canary control.

## Invocation

From the released repository root, run exactly:

```text
pnpm local:background-work-canary-control -- --env dev --project-ref xtbraqnlskmqxinjxxdn
```

No other public options are accepted. Presence of this source on `prod` does
not authorize a production invocation.

## Receipts and exits

Each run creates a mode-`0700` directory under the OS account home at
`~/.local/state/momi/background-work-canary/`. The directory contains the
append-only `receipt.ndjson` and, only after receipt verification, exclusive
mode-`0600` `final.json`. The single stdout envelope identifies the run, final
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
activation remains prohibited until its activation mutation is inside the exact
current guard-generation and unexpired database-lease fence in this same
orchestration. This tool contains no activation path.

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

## Post-run checks

For exit `0`, verify the printed `final.json` SHA-256, confirm its four fixed
target-inactive fields are true, confirm `guard.absent` is true, and preserve
both receipt files. Do not infer issue #330 activation readiness from this dry
run alone.

Stop for manual reconciliation after identity drift, a missed dead-man deadline,
unknown guard state, cleanup refusal, failed final fast/resource evidence,
receipt-chain failure, final-artifact failure, or lock-release failure. Do not
rerun while the exact guard may remain; a concurrent rerun is designed to fail.
