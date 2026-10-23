# Thirty-Day Cron History Retention

Use this supplement with [the main retention runbook](cron-history-retention-runbook.md).

## Select The Thirty-Day Profile

Keep the default profile unless the operator explicitly requests the thirty-day
policy. Before processing any history, select it as the migration owner while
disarmed or paused. Runtime roles receive no new configuration privilege:

```sql
select momi_cron_history.configure_retention_v1(30, '<approved UTC cutoff>'::timestamptz);
select phase, completed_raw_retention, initial_cutoff, initial_high_water_runid,
  dry_run_complete, canary_complete, accepted_rate_receipt
from momi_cron_history.policy_control;
```

The cutoff must be finite and no newer than the database clock minus thirty
days. The call captures the current maximum runid and resets acceptance without
deleting raw records. Record that exact cutoff and high-water readback. The
initial drain enters rolling thirty-day steady state at that high-water mark,
after the required dry-run and canary progression has authorized drain. Its
final receipt preserves the cutoff and high-water mark; subsequent cycles
capture a fresh mark and reset the scan cursor only on reaching it. Verify
that `initial_cutoff` is null, the phase is `steady`, and receipts remain healthy.
Changing profile after real coverage or deletion is refused; pause is the
immediate rollback. Restoring deleted records requires a separate verified
backup/archive restoration, never a retention-setting change.

For thirty-day scans, `scanned_count` includes retained candidates, and the
cursor advances even across unfinished, uncertain or held records. Such rows
are never summarized or removed by this profile. Rolling scans revisit them
after reaching the high-water mark. Recently completed rows can remain beyond
thirty days while a scan catches up or a health stop is active.
