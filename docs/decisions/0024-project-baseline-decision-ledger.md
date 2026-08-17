# 0024: Project Baseline decision ledger

- Status: accepted
- Date: 2026-08-17
- Owning issue: MOX-168

## Context

Project Baseline needs immutable material decision history without making the
database a competing work tracker. The mission begins before that database
ledger exists, so temporary Linear decisions also need exact one-time
reconciliation.

## Decision

Create `project-baseline-governance` as the database-only owner of private
schema `momi_governance`. Linear owns executable scope, status, dependencies,
acceptance, and restoration. The database owns immutable material decision
history after bootstrap reconciliation.

Every decision has a permanent UUID and stable source identity. Its immutable
event stream represents proposal, acceptance, rejection, supersession, and
revocation. Each event has a unique caller idempotency key and source identity,
canonical content, SHA-256 digest, durable evidence records, and durable
external references. Exact replay returns the first event; changed replay
fails. A versioned private read returns both history and current projection.
Every provenance preimage is the strict object `{schema_version: 1, encoding:
"utf-8", content: <string>}`. PostgreSQL computes SHA-256 over the exact UTF-8
`content` bytes, stores the preimage with the digest, and rejects a supplied
digest mismatch.

The bootstrap canonicalizer returns the exact entry used for its SHA-256 and
the ordered manifest SHA-256. The reconciliation routine accepts only the fixed
`project-baseline-pre-ledger-v1` identity and a singleton reconciliation row,
so the complete temporary ledger can reconcile globally once. It resolves only
earlier supersession references, appends proposed and accepted events, and
records the complete temporary-to-permanent map.

Supersession serializes both subject and target using deterministic UUID-order
transaction locks. The target's accepted projection is checked after those
locks are held. Exact replay is checked before requiring the target to remain
accepted, so an already-stored supersession remains replayable after a later
target revocation.

## Security and authority

The schema is absent from the Data API schema list. Public, anonymous,
authenticated, and service roles receive no access. RLS is enabled and forced
with no policies. Only the approved `postgres` migration/operator session, which bypasses RLS,
invokes the SECURITY INVOKER routines. Schema deployment remains exclusive to the exact-receipt GitHub development
release. After it lands, the user-authorized exact-dev Supabase SQL connector
first submits the pinned single-session `BEGIN`/`ROLLBACK` receipt. Only a
successful receipt authorizes the fixed bootstrap fixture or later ledger DML. It may not apply DDL, deploy repository code, target production,
or improvise another query; every call requires scoped readback and durable
source, idempotency, and evidence identities. PostgreSQL triggers reject every
update, delete, and truncate.

## Failure and rollback

Malformed, conflicting, out-of-order, or changed inputs fail the transaction.
Rollback revokes callers and preserves all history. Removing the schema or
promoting the ledger to production is separately approved destructive work and
is outside this mission.
