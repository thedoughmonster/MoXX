# MoMi Codex Hooks

The synchronous pre-tool hook protects only SQL migrations already present on
the trusted `origin/prod` authority. It denies supported Codex write and patch
operations before they can update, rename, or delete those files.

Migrations absent from production remain editable. If the production authority
cannot be resolved, migration edits fail closed with a `POLICY_AUTHORIZATION`
diagnostic that instructs escalation. The hook never changes the authority.

This is immediate feedback, not the security or validation boundary. Codex hook
trust and specialized tool paths can bypass repository hooks, so
`pnpm migration:check` and the PR `validate-final` job remain authoritative.

## Post-write diagnostics

The synchronous post-tool hook gives the active Codex turn immediate feedback
after a supported file edit. It inspects only paths named by that event and
returns compact developer `additionalContext` with a stable code, path,
severity, evidence, and repair class.

Incremental diagnostics cover the shared top-level-function and handwritten
line-limit rules, TypeScript and JSON parse failures, targeted workspace/service/
function manifest schema failures, and bounded inspector or generator failures.

The post-write hook never runs `momi-check`, `validate-final`, or a full
validation gate. It may invoke only the existing canonical deterministic
transformations below when an affected input makes their output stale:

- `pnpm catalog:generate` for `docs/service-catalog.md`;
- `pnpm quality:generate` for `docs/quality-metrics.json`.

Successful regeneration is reported as an `AUTO_FIX` diagnostic naming the
changed artifact. Focused coverage lives in `tests/codex_post_write_*.test.ts`;
the disposable live contract proof remains in `local-tools/codex-hook-contract/`.
