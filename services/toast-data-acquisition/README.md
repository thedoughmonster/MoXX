# Toast Data Acquisition

## ELI5

MoMi keeps a list of approved Toast questions. This service takes one saved
question, asks Toast for one page, files the complete answer, and either marks
the question done or leaves a safe bookmark for the next page.

## Purpose

This service is the generic, allowlisted Toast hydration boundary. It acquires
configured resources for durable jobs, preserves request history and raw source
responses, and records immutable resource versions plus observations.

## Owned Function

`toast-data-acquisition-v1` claims one `toast_acquisition.jobs` row. It never
acts as a caller-directed proxy: method, host, path, and accepted parameters are
loaded from the enabled acquisition registry.

## Contracts

The service provides `toast.data.acquisition.v1`. A POST contains only a job ID
and its capability token. Identical source content reuses its immutable version
while each retrieval creates a new observation.

Each source request inserts its archive attempt before transport and may
finalize that attempt exactly once. Completed attempts, resource versions, and
observations remain immutable.

Warehouse Projection consumes `toast.acquisition.projection_job_mode.v1` to
read the mode for one exact acquisition job. The owner contract exposes no
other job state and grants only exact routine execution; schema-wide access and
hosted workload identity remain outside this repository slice.

Recurring schedules initialize interval work as due immediately. Daily and
monthly work initializes at its next configured wall-clock time in the row's
time zone, so activation cannot release an accumulated startup backlog.
Windowed intervals remain due while closed and begin only when the captured
online-ordering window plus configured buffers is open.

The central dispatcher releases at most two due source requests per second.
Each operation has a configured per-tick cap; rank-one work across operations
is released before any operation receives a second slot. Expired leases and
live collection stay ahead of repair work, while historical backfill uses the
remaining capacity. Historical bulk-order pages stay at least five seconds
apart; every page and payment-detail discovery re-enters the same paced lane
instead of creating an immediate request burst.

Dispatch eligibility reads at most the latest 60 seconds of attempts and
releases. The operation registry cannot configure a longer spacing interval,
so older history cannot affect whether a request is currently eligible.

Coverage policy `toast-exit-archive-v1` classifies every enabled operation as
historical, current-only, or repair-only and records intentional exclusions.
Each new coverage result links to its exact job, dimensions, terminal attempt,
and pagination generation. Private ledger and integrity views expose missing
attempts, gaps, dead letters, and invalid response hashes without exposing raw
payloads.

## Authority

The service may authenticate with the configured Toast source and issue the
registered GET. It may write acquisition state and `toast_raw` archive records;
it may not project data, make decisions, or call another service.
The stock-snapshot completion event meaning belongs to this producer. Its
historical direct routing-table insert is removal-only constitution debt, not
permission for a new MoMi service call in the procurement request path.

## Verification

Run `npm run check -- --service toast-data-acquisition` with Node.js 24.
