# 0036: Release the Invoice Calendar Database with Runtime Access Deferred

- Status: accepted for the bounded development release
- Date: 2026-10-14
- Work: MOX-584; decision owner: Zac

Zac approved the development-only database release after reviewing seven tables,
six routines, one trigger, fulfillment metadata and a disabled policy row. This
extends ADR 0035's local-only boundary through the normal MoXX review and protected
development release. It does not authorize production or runtime activation.

## Decision

Keep `wholesale-invoicing` as the dataset owner for exactly the relations/routines
in its service manifest. `bridge` remains a shared namespace. No existing database
objects or trusted ownership are transferred: the development inspection found
the foundation absent, and the current trusted dev manifest has no invoice owner.

Use MoXX's existing ordered migration history and `deploy-dev.yml`; do not create
an independent bridge deployer or private migration ledger. The unapplied bridge
review is imported as one fresh CLI-generated migration. Preserve the original
bridge migration files there; do not enqueue their role-granting SQL here.

The private helper and command bodies, table/trigger definitions and revokes are
identical to the reviewed owner-only SQL. `provenance.json` pins the source hashes
and unchanged business body. MoXX's existing coordinator supplies target/history
and transaction checks in place of the proposed bridge coordinator's preflight.
The migration retains bounded timeouts, transaction lock and immediate owner/ACL,
RLS, inventory and empty-data verification. Unknown objects/default grants abort.

All seven tables use RLS. Four SECURITY DEFINER routines use their existing
migration object owner and empty search paths. No runtime role is created and no
runtime EXECUTE, schema, table or membership grant is installed. This supersedes
ADR 0035's proposed service-role grants for this initial hosted release.

Standing-order save.v2 records immutable fulfillment (`delivery` or `pickup`),
customer display name and terminal discontinuation with each accepted revision.
Effective pauses remain separate from sending holds. The scoped calendar reader
returns complete revisions and positive scheduled weekdays from one snapshot;
legacy missing metadata fails closed. No invoice history establishes active status.

## Acceptance and recovery

Local tests execute the actual pending migration in disposable PGlite, including
non-superuser ownership, private ACLs, rollback, retries, date/DST boundaries,
immutable versions and pause/hold/discontinuation. They do not replace the exact
PR validation receipt or prove independent-session contention or a live release.

After the protected development workflow succeeds, verify its exact release
receipt, migration version/checksum, the seven tables/six routines/one trigger,
RLS/private ACLs, absent runtime role, one disabled policy row and zero business
rows. No real order or task is required for this database-only acceptance.

Before commit, a failed migration transaction rolls back. After commit, preserve
records/history and correct through additive migrations; do not drop the schema,
rewind history or use a second publisher. Runtime access remains off throughout.

The ClickUp connector stays in moxx-bridge. Its runtime binding, confirmed real
orders, destination list, live reconciliation and scheduler need separate scope.
Existing unrelated platform gates must pass; this ADR does not waive them.
