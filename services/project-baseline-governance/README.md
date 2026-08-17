# Project Baseline Governance

## ELI5

This service is a sealed decision notebook. It records important Project
Baseline choices once, proves exactly what was written, and links later
corrections without erasing the original page.

## Boundary

The database-only service owns the private `momi_governance` operational
dataset. Linear remains the authority for executable scope, status,
dependencies, acceptance, and restoration. This service owns immutable
material decision history only.

Material decisions cover scope, architecture and contracts, data and security,
operations, rollout and production, debt acceptance, supersession, and mission
governance. Routine mechanics do not enter the ledger.

## Write and read contract

`append_decision_event_v1` gives each decision a stable source identity and
appends a legal lifecycle event: `proposed`, `accepted`, `rejected`,
`superseded`, or `revoked`. Every event has one caller idempotency key and
one source identity. An exact replay returns the first event; changed content,
source identity, or idempotency reuse fails.

Every provenance preimage has exactly `{schema_version: 1, encoding: "utf-8",
content: <string>}`. PostgreSQL computes SHA-256 over the exact UTF-8 `content`
bytes and rejects any supplied digest that differs. Evidence and external
references store both this reconstructable preimage and its computed digest as
separate immutable records bound to the event and canonical document.
`read_decision_history_v1` returns ordered version history and the current
projection without rewriting stored rows. Update, delete, and truncate are
rejected on every ledger table.

`canonicalize_bootstrap_entry_v1` returns the exact entry that is hashed.
`reconcile_bootstrap_v1` accepts one ordered bootstrap array, canonicalizes
every entry, validates its supplied digest, computes the ordered manifest
digest, and compares it to the expected digest. One fixed bootstrap identity
and a singleton row make reconciliation globally one-shot. It appends proposed
and accepted events, resolves earlier supersession links, and saves the full
temporary-to-permanent map exactly once.

Supersession locks the subject and related decision in deterministic UUID order
before checking either current projection. This prevents a concurrent revoke
from committing beside a supersession that relied on stale target state; exact
replay is still resolved before the current-target check.

## Access

The schema is not a Data API schema. Public, anonymous, authenticated, and
service roles receive no schema, table, sequence, or routine access. RLS is
enabled and forced with no policies. The only intended caller is a trusted `postgres` migration/operator session.
Schema deployment uses the exact-receipt GitHub development release. The
user-authorized exact-dev Supabase SQL connector then submits the pinned
single-session rollback receipt. Only after it passes may the connector submit
the fixed bootstrap fixture or explicit ledger DML. It cannot substitute for DDL or repository
deployment and must never target production. As a BYPASSRLS operator it can
execute the SECURITY INVOKER routines; application and Data API roles cannot.

## Verification and rollback

Repository tests statically verify the declared contract. They do not prove
PostgreSQL runtime behavior. Development verification must produce a real
rolled-back transaction receipt before any real decision is appended.
The rollback-only SQL fixture may also run against disposable PostgreSQL 17
before publication, but that local result is not a development receipt.

Rollback stops callers and revokes access; it never deletes decision history.
Schema removal requires a separately approved destructive migration and is not
part of Project Baseline.
