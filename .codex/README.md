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
