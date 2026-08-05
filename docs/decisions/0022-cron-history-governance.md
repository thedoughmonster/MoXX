# 0022: Cron History Governance

- Status: accepted
- Date: 2026-08-05
- Owning issue: #402

## Context

`cron.job_run_details` is extension-owned diagnostic history, not a MoMi
dataset. Production retains it without a bound, and routine high-frequency jobs
create about 160,000 rows each day. Ordinary deletion and vacuum can make those
pages reusable by PostgreSQL, but they do not shrink the allocated Supabase
disk.

Cleanup must not trade storage pressure for database pressure or erase evidence
needed to understand failures. Provider CPU, memory, I/O, disk, connection,
queue, and freshness signals are therefore part of the write authority, not
optional dashboards.

## Decision

Create `cron-history-governance` as owner of the private operational dataset
`momi.cron_history_governance` in `momi_cron_history`. It owns policy, health
samples, cursor and gap state, sanitized minute summaries, exceptional run
metadata, incident holds, batch coverage, and receipts. It consumes but never
owns `cron.job_run_details` and does not own any business queue.

Terminal raw rows remain for seven days. Routine rows then contribute to
per-job, per-minute summaries retained for 90 days. Failures, the first terminal
recovery after failure, runs lasting at least three seconds, unrecognized
outcomes, and declared exceptions remain individually available in the extension
table for 365 days. Active incident holds preserve raw rows until explicit
release. `end_time` is authoritative; incomplete rows are never deleted.

A single one-minute cron job dispatches an internal Edge Function only while an
operator-selected phase is active. The function scrapes the same project's
Supabase Metrics API with a dedicated Secret API key, reduces only allowlisted
Prometheus series, and submits no raw exposition text. This is the accepted
exception to normal source/destination network rules: it calls only the
same-origin Supabase metrics endpoint and owned database routines. The database
adapter sends only an expiring tick identity and capability token. Missing
metrics, secrets, mappings, or health evidence fails closed.

The cleanup routine uses one transaction, an exact advisory lock, a bounded
forward primary-key cursor, and a captured high-water mark. It writes and
verifies sanitized aggregate or exception coverage before any exact-runid
delete. It never scans by age, catches up back-to-back, or runs during locks,
vacuum, queue degradation, provider pressure, or stale health evidence.

## Release And Space Contract

The migration installs the schedule disarmed. Activation progresses through a
healthy 15-minute baseline, count-only dry run, one at-most-500-row canary, and
then at most 1,000 rows once per minute. A separately accepted receipt is
required before raising that rate; 5,000 rows is the absolute ceiling.
Development must prove the exact commit before production promotion.

The intended result is reusable internal PostgreSQL space. `VACUUM FULL`,
`CLUSTER`, `pg_repack`, extension or table rewrites, restart, resize, project
upgrade, and physical disk shrink remain separately gated.

## Consequences

- Raw routine diagnostics remain available for seven days and sanitized
  long-window evidence remains bounded.
- A metrics outage or ambiguous commit stops cleanup instead of guessing.
- The governor adds one low-frequency cron-history row per active minute.
- Reports distinguish reusable relation pages from physical disk allocation.
