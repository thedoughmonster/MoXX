# 0037: Standing Development Bridge Schema Administration Exception

- Status: accepted project deployment policy
- Date: 2026-10-14
- Decision owner: Zac; recorded in MOX-584
- Approval: `Sentinel_c09abc2885948191a04041ef000fe5c2`

Zac approved the simpler schema-administration route and expanded its duration:
"all work done in bridge schema get this exception." This is a standing
exception for eligible development bridge work, not a bootstrap-only waiver.

## Scope and precedence

Authorized work confined to exact owned objects in schema `bridge` on Supabase
development project `xtbraqnlskmqxinjxxdn` may use the existing authorized
Supabase administration connection and focused validation. A normal MoXX merge,
global validation receipt, release coordinator or protected workflow is not a
prerequisite for that database administration. Unrelated external-function
authority expiry does not block this path and must not be renewed as a side task.

This narrowly supersedes the conflicting deployment-path requirements in ADRs
0006, 0008 and 0036, the agent deployment procedure, and the bridge source rules.
It does not change the normal release process or GitHub merge protections.
An owning task still supplies the intended change; a schema name alone is not
permission for arbitrary data changes or another service's objects.

Production, other schemas, credential creation, expanded runtime/security
grants, irreversible deletion and live external actions remain outside this
exception. It grants no Edge Function deployment, API exposure, scheduler,
customer import, provider action or ownership transfer. Preserve exact dataset
owners; the invoice service does not own every object in the shared namespace.
Read-only catalog/history inspection needed to verify scope is permitted.

## Execution and evidence

1. Read this decision and the owning task, inspect current workers/source state,
   and pin the exact target, object list, SQL bytes and SHA-256 before applying.
2. Use only the existing connected administration access. Verify the development
   project, current privileges and relevant object/history baseline without
   secrets or customer payloads. No new credential or privilege grant is implied.
3. Run focused tests for affected SQL/contracts, ownership, permissions, failure
   rollback and retry behavior. Preserve private access and qualified objects.
   Do not disable global checks or fabricate a passing MoXX release receipt.
4. Apply the reviewed change transactionally with bounded lock/statement timeouts
   and explicit conflict checks. Respect platform confirmations and denials.
   Stop on unexpected objects, access, target, history or an uncertain outcome;
   reconcile read-only before any retry. Do not invent another publisher.
5. Verify actual objects, permissions and task-specific acceptance after apply.
   Retain a content-free receipt with target, SQL hash, actual migration identity,
   approval, tests and readback. A source artifact or successful request alone
   does not prove that the intended database state exists.

Standard Supabase-managed migration registration for the exact bridge change is
allowed as required bookkeeping. No private ledger, manual history edit, repair,
renumbering of applied records or mutation of unrelated history is authorized.
If the connected tool assigns a version, retain that actual version and exact
SQL bytes. Do not claim the pending repository timestamp was applied instead.

Before a source PR can merge, reconcile its unapplied file identity to the
verified hosted version, preserve the original identity in provenance, and
ensure only one copy can enter the migration queue. Applied SQL stays immutable.
PR62 must remain draft/unmerged until this reconciliation is verified. Normal
merge checks remain applicable; this policy does not waive branch protection.

Failure before commit rolls back the transaction. After a committed change,
preserve data and evidence; corrections are additive under the same bounded
scope. Destructive cleanup or a change outside these boundaries needs its own
authorization. If this task's connected access cannot perform the operation,
return the exact SQL and prerequisites to the parent for execution.

For the current bootstrap, seven tables, six routines, one revision guard and
one disabled policy row are authorized. Runtime roles/grants, real orders,
ClickUp writes and scheduling remain off. Database installation is not live sync.
