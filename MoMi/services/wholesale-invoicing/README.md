# Wholesale Invoicing

## ELI5

Save repeating case orders, choose effective dates, and preview weekly cost.
A preview is an estimate. Database constraints keep invoice sending disabled.

Owner: wholesale-invoicing. Decisions: ADRs 0035/0036. Work: MOX-584.
Only exact declared invoice objects belong to this service; bridge is shared.

## Trigger and access

The approved migration identity installs private database commands and a calendar
reader. There is no HTTP route, Edge Function, cron, external host or secret.
No runtime role, membership or EXECUTE grant is created. PUBLIC, anon,
authenticated and service_role remain unable to call the routines or read tables.

The calendar contract supplies `standing_order.save.v2` and
`calendar.read.v1` on the same relations. It stores explicit pickup/delivery and
discontinuation metadata with each immutable revision. One fresh migration
packages the reviewed owner-only definitions; `provenance.json` records exact
source and output hashes. Original bridge migrations are retained in that repo.

## Save input and output

Contract: momi.wholesale_invoicing.standing_order.save.v1.
Routine: bridge.invoice_save_standing_order_v1(uuid, integer, jsonb, jsonb).
The calendar-capable save.v2 appends a fifth JSON argument with `customer_name`,
`fulfillment` (`delivery` or `pickup`) and boolean `discontinued`. Discontinuation
requires pause and makes that order identity terminal. New v1 revisions cannot
follow a v2 revision; missing legacy metadata stops calendar reads without inference.
`bridge.invoice_calendar_snapshot_v1(environment, merchant_id, location_id)` returns
every order/revision and positive scheduled weekday for that exact scope in one
statement snapshot. Caller authentication/scope authorization awaits runtime binding.

Provide a stable command UUID, expected revision (zero to create), complete
identity and complete schedule. Exact replay returns the original save result.
A changed request with the same command UUID fails; a stale revision fails.

Identity fields:
- environment: dev or prod; merchant_id, location_id and client_id: opaque IDs.
- currency: explicit uppercase three-letter code; all prices use this currency.
- protected_through: optional inclusive already-invoiced Sunday, otherwise null.
  This field, currency and identity are immutable. Do not seed real coverage
  until the accepted historical invoices have been reconciled separately.

Schedule fields:
- effective_from: strict YYYY-MM-DD; paused and sending_hold: booleans.
- notes: string up to 1000 characters; lines: array of at most 100 entries.
- Each entry has weekday (Monday=1, Sunday=7), catalog_item_id, catalog_version,
  name, case_quantity, case_price_minor and catalog_snapshot (complete supplied
  catalog evidence as an object). Quantity is 1–100000; price is 0–1000000000.
- No duplicate item on the same weekday; no fractional cases or minor units.
  A paused schedule may contain no lines. Other schedules need at least one.

The result contains order_id, version_id, revision, command_id and effective_from.
Every accepted save retains the full normalized JSONB request. Accepted versions
and their line snapshots are append-only through the available contracts.

For each date, the highest accepted revision already effective wins. A later
command replaces older planned terms from its chosen date; dates before that
retain older terms. Pause removes scheduled cases from that date; resume is a
later unpaused full schedule. Hold sending retains cases and records the hold.
Edits before initial effectivity or through protected invoiced history fail.

## Preview input and output

Contract: momi.wholesale_invoicing.week.preview.v1.
Routine: bridge.invoice_preview_week_v1(uuid, date).

Provide order_id and a local Monday. The result has seven America/New_York dates,
standing_order basis, disabled policy, hold state, currency, zero tax, exact
subtotal/total in integer minor units, and stable dated notes and line snapshots.
case_quantity multiplies price per case once, irrespective of case pack size.
Dates use calendar addition; daylight-saving weeks never lose or gain a day.

week_id identifies the one environment/merchant/location/client/week identity.
snapshot_id identifies an immutable preview at an accepted order revision.
Retrying that revision returns the same snapshot. Editing an unprotected
standing order can create another preview revision with the same week_id.
A preview never locks future editing or claims a provider invoice exists.
Weeks overlapping protected history fail. No real customer data is seeded.

## Side effects and failure handling

Save appends versions and updates the order revision. Preview creates the weekly
identity and immutable snapshot/lines once per revision. Both lock the same order
row; database unique constraints also fence identities. There is no network work.

Invalid fields, incomplete snapshots, identity changes, protected dates and
changed-payload command retries fail with invoice_* errors and roll back.
invoice_revision_conflict uses SQLSTATE 40001: reread and deliberately resubmit
with a fresh command key after resolving the conflict, never overwrite silently.
Unknown order/week and total values above JavaScript's safe integer range fail.
Global enabled=false is enforced by CHECK, not a caller-controlled flag.

## Tests

Run from MoMi with Node 24.14.x and pnpm 11.7.x:

```powershell
node --test services/wholesale-invoicing/tests/*.test.ts
pnpm momi-check changed
```

Tests execute the actual migration in embedded PostgreSQL (PGlite) with synthetic
fixtures, including replay/fencing, price/version history, input rejection,
protected intervals, daylight-saving dates, ACLs, rollback and unrelated objects.
Queued duplicate requests test idempotency; PGlite serializes one connection,
so they do not claim a two-session lock-contention test.

## Delivery and rollback

Development bootstrap `20261014090216` is applied and verified; see
`development-bootstrap-evidence.json` for the exact SQL hash and private state.
ADR 0037 permits existing connected development administration and focused checks.
Retain actual migration identity and bytes; no private ledger or new publisher.
The migration verifies exact objects, owner-only ACLs, RLS, disabled policy and
zero business rows before commit; `verify-bootstrap.sql` repeats read-only
acceptance immediately afterward as the same approved owner. Unknown grants abort.
Any later correction is additive. No customer seed, ClickUp task, runtime access,
scheduler, sending or production deployment is authorized by this database slice.
