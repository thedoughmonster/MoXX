# Cron History Retention Runbook

Use this runbook only after the exact validated #402 commit reaches the target.
The migration is safe on arrival: the schedule exists, but
`policy_control.phase` is `disarmed`, so it performs no network request or
cleanup. The thirty-day profile also requires the exact validated retention
revision and its development-to-production release receipts. Verify hosted
migration history before release: an unrelated missing migration is a release
blocker, not permission to apply the backlog or mark it applied.

## Provider Preparation

Reuse only the runtime-injected JSON entry `SUPABASE_SECRET_KEYS['default']`.
It has broad `service_role` authority; rotation also affects its other consumers.
No legacy/custom/PAT fallback, secret listing, copying or configuration is allowed.
Before any request, require the exact canonical dev/prod `SUPABASE_URL` and the
same project in `DENO_DEPLOYMENT_ID`; the governed `SUPABASE_DB_URL` is also required.
Scrape `/customer/v1/privileged/metrics` on that origin once per minute with HTTP
Basic authentication as `service_role`, using the selected key only internally.
See [default secrets](https://supabase.com/docs/guides/functions/secrets#default-secrets)
and the [Metrics API guide](https://supabase.com/docs/guides/observability/metrics/vendor-agnostic).

Inspect one redacted metric-name inventory and prove every accepted CPU,
RAM/swap, I/O, allocated-disk, and connection series in that environment.
PostgreSQL derives provider pressure only from the accepted resource thresholds
after counter deltas are available; no separate provider-warning metric is
configured. Do not activate if any required resource series is absent. The
post-deployment `GET` must return `configured` without exposing any value. This
checks parser/project presence only, not successful Metrics API authentication.
Runtime presence is unverified until that check; owner selection is consent,
not live evidence. Failure blocks a release success receipt and keeps cleanup
disarmed. SQL may already have committed: report partial state; never replay it.

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

For an explicitly requested thirty-day policy, follow the
[thirty-day selection supplement](cron-history-thirty-day-policy.md) before the dry run.

## Count-Only Dry Run

```sql
select momi_cron_history.configure_v1('dry_run', 500, <order_alert_dlq_ceiling>, <projection_dlq_ceiling>, null);
```

The collector first builds 15 complete, authenticated one-minute health samples.
It then creates one `dry_run` receipt, changing no raw row, summary, exception, cursor or gap state,
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
and may never exceed 5,000. These limits originate in ADR 0022, not a Supabase
platform limit. The configuration routine checks the receipt key's presence,
not its external acceptance: the operator must verify that evidence. Use a
measured step such as 2,000 only after a healthy 1,000-row receipt demonstrates
duration below three seconds, WAL below 32 MiB, no spill and unchanged health.
Review the same evidence before any further increase, never exceed 5,000, and
do not interpret the internal thirty-second rate backstop as permission for
twice-per-minute execution. Scan throughput includes retained rows; deletion
throughput and completion time must come from actual receipts.

For the default profile, when the cursor reaches the seven-day boundary and receipts stay healthy, switch
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
