# 0035: Disabled Wholesale Standing Orders and Invoice Previews

- Status: accepted for the bounded local implementation
- Date: 2026-10-12
- Work: MOX-584 / MO-XX-SUB-083; parent decision MOX-281
- Decision owner: Zac

## Context

Wholesale invoicing needs editable standing-order storage and deterministic
weekly previews using existing Supabase capacity. Zac accepted an invoice
owner inside the shared bridge schema, prospective effective dates, preserved
agreed prices and invoiced history, Pause order and separate Hold sending.
The accepted 2026-10-12 scope excludes delivery, provider calls and deployment.

## Decision

The dataset_owner service wholesale-invoicing owns exactly its invoice-prefixed
relations and routines declared in service.json. It claims neither private_schema
bridge nor future bridge objects. Other modules require their own exact ownership.
ADR 0013 remains binding; this creates no competing order or payment authority.

Use private versioned database commands for standing-order saves and weekly
previews. There is no Edge Function, public HTTP endpoint, scheduler or consumer.
The new NOLOGIN service role may execute only the two declared owner commands.
It receives no membership, login credential, direct table access or schema CREATE.
Tables use row-level security. Commands use a fixed empty search_path and no
dynamic SQL. Helpers are not granted to runtime roles.

### Standing orders

One order identity is environment, merchant, location and client. Identity,
currency and an optional protected-through date are immutable after creation.
The protected-through date denotes already-invoiced coverage and ends on Sunday.
No real client, protection interval or historical coverage is seeded by this work.

Every save supplies a stable command UUID, expected revision, complete identity
and complete schedule. Serialize commands and previews on the order row.
A replay with the same normalized JSONB request returns its original result;
changed payload reuse fails. Version fencing rejects stale concurrent writers.

Versions are append-only. For each date, select the highest accepted revision
whose effective date has arrived. Thus a new full schedule supersedes older
planned schedules from its chosen date, while earlier dates retain prior terms.
Reject edits at or before explicitly protected invoiced history and edits before
the order's initial effective date. Preview creation alone never freezes edits.

Pause suppresses future scheduled cases from its effective date; resume is a
later full unpaused version. Hold sending preserves cases and records a delivery
hold. Neither option removes prior evidence. Each line snapshots catalog identity,
version, name, optional complete catalog evidence, case count and case price.

### Weekly previews

Weeks are local Monday through Sunday in America/New_York. Expand calendar dates,
not fixed 168-hour durations. One weekly identity exists per order and Monday.
A preview snapshot is unique per weekly identity and order revision. Exact retries
return the same snapshot. A later permitted edit produces a new immutable preview
revision under the same weekly identity; it never creates a second invoice key.

Use integer minor-unit price per case multiplied by whole case quantity exactly
once. Enforce a single explicit currency and zero tax; no automatic charging.
Snapshot each dated line and deterministic note. Mark basis=standing_order;
never imply scheduled cases are verified delivered sales. Bound inputs and totals.

The singleton initial policy is enabled=false with a database constraint that
forbids enabling it. There is no destination, send intent, provider invoice,
network call, cron, secret or live customer configuration in this implementation.

## Consequences and release boundary

Synthetic embedded-PostgreSQL tests execute the actual migrations without
Docker, hosted access or credentials. Exact object declarations precede behavior.
Generate new migrations with the pinned Supabase CLI and preserve applied history.
The initial schema creation is permitted because this is its first declared
participant; future bridge participants prohibit owner-local schema-wide grants.

This task delivers local code and focused validation only. Public push, PR,
merge, hosted migration apply and release need their own user authority.
GitHub Actions remains the sole deployment authority; no expired attestation
is rewritten or bypassed. A later applied-schema correction is additive.

A later UI needs separately accepted authentication and authorization.
Provider drafts, unknown-result reconciliation, historical coverage reconciliation,
Monday 10:00 sending, delivery activation and production remain separate work.
No function here can send an invoice, even if a caller supplies enabled=true.
