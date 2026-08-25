# Cron History Retention Runbook

Use this runbook only after the exact validated #402 commit reaches the target.
The migration is safe on arrival: the schedule exists, but
`policy_control.phase` is `disarmed`, so it performs no network request or
cleanup.

## Provider Preparation

For each environment, create a dedicated Supabase Secret API key for metrics
automation. Store it only as the Edge Function secret
`MOMI_CRON_HISTORY_METRICS_SECRET_KEY`; never print, commit, or send it. Scrape
`https://<project-ref>.supabase.co/customer/v1/privileged/metrics` once per
minute with HTTP Basic authentication as `service_role`, following the
[Supabase Metrics API guide](https://supabase.com/docs/guides/monitoring-and-debugging/metrics/vendor-agnostic).

Inspect one redacted metric-name inventory and prove every accepted CPU,
RAM/swap, I/O, allocated-disk, and connection series in that environment.
PostgreSQL derives provider pressure only from the accepted resource thresholds
after counter deltas are available; no separate provider-warning metric is
configured. Do not activate if any required resource series is absent. The
function also requires the governed `SUPABASE_DB_URL` and `SUPABASE_URL`; its
health `GET` must return `configured` without exposing any value.

## Preflight

Confirm the exact release receipt, no incident or maintenance overlap, no
waiting lock, no active vacuum, no transaction older than 30 seconds, and
current queue/dead-letter baselines. Configure the accepted ceilings while still
disarmed:

```sql
select momi_cron_history.configure_v1('disarmed', 500, <order_alert_dlq_ceiling>, <projection_dlq_ceiling>, null);
```

Production's accepted starting ceilings are four order-alert dead letters and
zero warehouse-projection dead letters. Development uses its own exact readback,
never a copied production value.

## Count-Only Dry Run

```sql
select momi_cron_history.configure_v1('dry_run', 500, <order_alert_dlq_ceiling>, <projection_dlq_ceiling>, null);
```

The collector first builds 15 complete one-minute samples. It then creates one
`dry_run` receipt, changes no raw row, summary, exception, cursor, or gap state,
and returns to `paused`.

```sql
select phase, dry_run_complete, last_stop_reason, updated_at
from momi_cron_history.policy_control;
select batch_status, scanned_count, summarized_count, exception_count,
  held_count, deleted_count, cursor_before, cursor_after, wal_bytes,
  temp_bytes, duration_ms
from momi_cron_history.batch_receipts order by created_at desc limit 1;
```

Advance only when `dry_run_complete` is true, `deleted_count` is zero, the
cursor is unchanged, the receipt is exact, and all health signals stayed clean.

## One Canary

```sql
select momi_cron_history.configure_v1('canary', 500, <order_alert_dlq_ceiling>, <projection_dlq_ceiling>, null);
```

The governor pauses after one receipt. Verify summary and exception coverage,
exact raw deletion, the cursor, WAL below 32 MiB, zero temp bytes, duration
below three seconds, queues, locks, connections, and provider samples.

## Drain And Steady State

```sql
select momi_cron_history.configure_v1('drain', 1000, <order_alert_dlq_ceiling>, <projection_dlq_ceiling>, null);
```

The job performs at most one transaction per minute and never catches up
back-to-back. It pauses on health pressure, stale or incomplete metrics, two
identical batch failures, or one unresolved claimed tick. Review the exact stop
reason before resuming. A rate above 1,000 requires a newly accepted receipt key
and may never exceed 5,000.

When the cursor reaches the seven-day boundary and receipts stay healthy, switch
to `steady` at 1,000 or lower. Stop immediately with:

```sql
select momi_cron_history.pause_v1('operator_pause');
```

## Holds And Declared Exceptions

Register before the seven-day raw window closes:

```sql
select momi_cron_history.register_hold_v1(<runid>, '<incident-key>', 'incident');
select momi_cron_history.register_exception_v1(<runid>, 'declared_exception', '<declaration-key>');
```

Release never occurs implicitly:

```sql
select momi_cron_history.release_hold_v1(<runid>, '<release-key>');
```

## Completion Readback

Report exact raw and summary/exception counts, relation heap/index/total bytes,
cursor and remaining backlog, receipts, health maxima, queue/dead-letter state,
locks, vacuums, and unrelated operational freshness. Ordinary deletion and
standard vacuum make pages reusable internally; they do not shrink allocated
disk. See Supabase
[Database Size](https://supabase.com/docs/guides/platform/database-size) and
[disk reclamation guidance](https://supabase.com/docs/guides/troubleshooting/disk-size-not-shrinking-after-deleting-data-135390).

Do not run `VACUUM FULL`, `CLUSTER`, `pg_repack`, a rewrite, restart, resize, or
upgrade here. Physical reclamation is a separate maintenance gate.
