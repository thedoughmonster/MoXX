# Toast Exit Archive Runbook

## Deadline

The self-sufficient archive must be complete by November 29, 2026. Continued
Toast access after that date is a reconciliation window, not a dependency.

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

Capture restaurant detail first so Toast supplies the archive anchor. Release
one acquisition job every five seconds, with expired leases and live collection
ahead of repair and backfill work. Payment detail fanout must enter the same
paced lane rather than wake every discovered payment at once. New events and
deliveries only create durable work; routing and projection each wake one item
every three seconds. Database-backed Edge adapters release idle sessions after
two seconds and rotate every connection within one minute.

## Coverage

For every operation and expected date/window, record complete, empty, partial,
gap, or accepted-gap status in `toast_acquisition.coverage_windows`. A 200 with
no records is different from a missing attempt. Re-run partial windows until
complete or explicitly accepted.

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

The first release creates schemas, functions, schedules, subscriptions, and
durable work in an inactive state because database migrations finish before the
matching Edge deployment. After all hosted function metadata is verified, run
controlled POST canaries for acquisition, routing, projection, canonical read,
and alert acknowledgement. A separate activation migration may then enable the
acquisition route and capture one real ordering schedule. Enable recurring
schedules only after its configured buffers produce active capture windows. A
second stage enables event routing, Toast projection, canonical readers, and
their recovery jobs while order-alert event delivery remains inactive. Legacy
hydration and reading remain active until their queues are drained and that
activation has soaked.
