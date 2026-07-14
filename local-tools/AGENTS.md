# Local Tooling Agent Contract

## Scope

This directory is for private commands run intentionally by a MoMi operator
from a trusted workstation. It is source-controlled on both `dev` and `prod`
so production promotion can remain an exact-commit operation.

## Hard Rules

- Never deploy, host, schedule, or expose anything in this directory.
- Never add `function.json`, `service.json`, a Supabase adapter, or a migration.
- Never reference a local command from GitHub Actions or production runtime code.
- Never import local-tool implementation into a service or Edge Function.
- Never commit credentials, access tokens, source secrets, or production data.
- Read credentials only from an ignored local environment or approved store.
- Keep source acquisition logic owned by its service; do not fork or duplicate it.
- Require an explicit target environment and project reference for data writes.
- Require dry-run support and typed confirmation before a production data write.
- Make long operations idempotent, checkpointed, resumable, and auditable.
- Record a run identifier, requested range, counts, and failures for each write run.
- Do not implement a backfill until the user explicitly approves that work.

If a command needs remote invocation, a public route, or automatic scheduling,
it is no longer local tooling. Propose it as a service through an ADR instead.
