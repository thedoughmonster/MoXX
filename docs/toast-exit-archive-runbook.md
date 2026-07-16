# Toast Exit Archive Runbook

## Deadline

The archive must be self-sufficient by November 29, 2026; later Toast access is reconciliation only.

## Collection

- Live: webhooks for orders, stock, menus, packaging, availability, and ordering
  schedules; stock every minute and availability every ten minutes inside the
  database capture window; menu metadata every thirty minutes.
- Daily: full fallback snapshots of webhook-backed resources, all 24 published
  configuration collections, restaurants, devices, packaging, schedules,
  employees, jobs, recent shifts, modified time entries, prep stations, and
  stock state.
- After close: bulk orders, all payment date selectors, cash entries/deposits,
  and kitchen fulfillment. Record kitchen HTTP 204 as an accepted capability gap.
- Monthly: rescan all historical shifts because the API has no modified filter.
- Repair: use exact-resource endpoints only for targeted gaps.

Backfill orders, payments, cash, shifts, time entries, and kitchen data from the
restaurant `firstBusinessDate`. Use resumable day or month windows and complete
pagination. Never substitute a guessed opening date.

Capture restaurant detail first. Release one job every five seconds; keep expired leases and live collection
ahead of repair/backfill, and pace payment detail fanout in the same lane. New
events and deliveries only create durable work. Routing keeps its existing wake
path. Every three seconds, projection processes up to six independently
committed deliveries within 60 seconds; its Edge trigger and HTTP wake are inactive. Remaining Edge
adapters release idle sessions after two seconds and rotate connections within
one minute. Toast acquisition and webhook HTTP boundaries are unchanged.

## Coverage

For every operation and expected date/window, record complete, empty, partial,
gap, or accepted-gap status in `toast_acquisition.coverage_windows`. A 200 with
no records is different from a missing attempt. Re-run partial windows until
complete or explicitly accepted.

Use `toast_acquisition.coverage_ledger_v1` as the job-level ledger. Its
obligation key, parameters, selector, source window, terminal attempt, and
pagination generation distinguish repeated snapshots and all three payment
date selectors. `toast_acquisition.operation_coverage_v1` must list every
enabled bulk-capable operation with an active schedule; repair-only operations
must remain unscheduled.

`toast_acquisition.expected_archive_obligations_v1` derives every historical
window independently from the coverage policy and Toast `firstBusinessDate`.
The versioned `historical_coverage_bounds` row pins this archive's backfill
through date to July 15, 2026; recurring schedules own later observations.
Use `archive_obligation_status_v1` to expose a missing job instead of silently
omitting that window from the job-level ledger.

Archive acceptance requires zero rows from
`toast_acquisition.archive_acceptance_findings_v1`. This verifies source-response
hashes and relationships, expected jobs, schedules, and backfill anchors, and
blocks unresolved processing failures or dead letters without copying response
payloads out of `toast_raw`.

Replay `canonical-resource-v2` from immutable raw versions and observations with
set-based, append-only writes that add idempotent v2 versions, link
every observation, emit one event per version, and preserve v1 history. Verify
published menu versions win reads over later sparse snapshots.

## Manual Exports

Register every enabled product without API coverage in
`momi_archive.product_gap_register`. Record operator, method, last export, next
due date, archive path, byte size, and SHA-256 for every run.

Perform exports monthly, immediately before November 29, and once more before
final Toast account closure. Store original files untouched.

The register is pre-seeded with accepted, non-repairable historical gaps for
stock, deleted menus and configuration, availability, ordering schedules,
packaging, devices, and kitchen HTTP 204 responses. These rows have no invented
cadence because an operator export cannot reconstruct the missing history.
Every enabled Toast product without API coverage gets its own additional row
with its real export method and a 30-day cadence. Record the monthly,
pre-November-29, and pre-closure files as separate immutable `export_runs`.
Supply an export kind, byte size, original archive path, operator, and SHA-256
for every run. Use `momi_archive.product_export_status_v1` for latest evidence
and due dates; `manual_export_findings_v1` lists every overdue recurring export.

## NAS Backup

Run the local PostgreSQL 17 NAS export nightly. It creates a compressed custom
logical dump, portable source/warehouse export metadata, untouched manual files,
and a SHA-256 manifest published last. Secrets must never enter arguments,
manifests, logs, or run state.

Retain 30 daily, 12 monthly, and every annual snapshot. Mark legal or operational
holds explicitly before pruning. An encrypted off-site USB copy is recommended.

## Restore Drill

Quarterly, verify every checksum and archive TOC, restore into an empty isolated
PostgreSQL 17 target, analyze it, compare object and row counts, exercise the
canonical readers, and save a data-free drill report. Never use dev or prod as
the restore target.

## Milestones

- July 31: backbone, canonical contracts, schedules, and six tested subscriptions.
- September 30: historical backfill and date/endpoint coverage ledger complete.
- October: canonical order-alert cutover, mapping verification, first NAS restore.
- November: final reconciliation, manual exports, pre-cutover delta, signed manifest.
- Post-switch: overlap capture, final reconciliation, then seal the Toast archive.

## Safe Activation

The first release keeps all resources and durable work inactive because migrations precede Edge deployment.
After hosted metadata is verified, run POST canaries for
acquisition, routing, canonical read, and alert acknowledgement. Enqueue one
projection delivery and verify database begin/ack/fail/retry state. A separate
migration may enable acquisition and capture one ordering schedule; enable
recurrence only after configured buffers create active windows. Stage two
enables routing, database-native Toast projection, canonical readers, and
recovery while order-alert delivery remains inactive. Keep legacy hydration and
reading active until their queues drain and activation has soaked.
