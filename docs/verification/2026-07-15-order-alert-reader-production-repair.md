# Production Order Alert Reader Repair

Verified July 15, 2026 in production.

## Incident

Order webhooks continued to arrive, but alert evaluation reads returned HTTP 500
or 504 after spending 25 to 120 seconds in the legacy order presentation view.
Slack delivery itself remained healthy. The view expanded presentation data for
every stored order before filtering to the requested order.

## Emergency Repair

- Installed a private immutable one-payload presentation helper.
- Replaced both legacy reader views with targeted per-payload projections.
- Preserved the existing columns, security-invoker behavior, and role revokes.
- Kept Toast credentials, raw payloads, decision rules, and Slack delivery
  unchanged.

The permanent warehouse projection migrations already use the same targeted
shape. Migration `20260715164643_retire_emergency_order_reader_hotfix.sql`
removes the temporary helper after those views take ownership.

## Verification

- A controlled canary completed the reader, decision, and Slack path in under
  one second.
- Replayed 42 reader failures and one earlier transient 503 individually.
- All 43 evaluations succeeded; no replay work remained pending or running.
- Six Slack delivery attempts created after the repair all returned HTTP 200.
- Zero alert evaluations remained failed in the preceding 48-hour window.
- Final database state used 13 of 60 connections with no idle `postgres.js`
  sessions.

## Follow-Up

Production still runs the older Edge build without the bounded idle-connection
settings already tested on `dev`. Replay batches exposed that limitation, so
the repair used one-at-a-time calls and removed only stale idle sessions between
waves. Do not promote the wider `dev` stack solely for this setting; use the
normal approved release path when the planned production cutover is ready.
