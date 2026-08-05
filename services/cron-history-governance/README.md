# Cron History Governance

## ELI5

This service is a careful filing clerk for database-job receipts. It keeps the
recent originals, saves compact older totals, protects unusual or held runs, and
stops immediately when the database looks busy or uncertain.

## Boundary

The service owns `momi.cron_history_governance` in private schema
`momi_cron_history`. It reads and deletes eligible rows from the pg_cron-owned
`cron.job_run_details` table only through accepted bounded procedures. It does
not own pg_cron, business queues, or physical disk reclamation.

## Retention

Raw terminal history is kept for seven days. Routine rows become sanitized
per-job/per-minute summaries for 90 days. Failures, recoveries, slow runs,
unexpected results, and declared exceptions remain raw for 365 days. Active
incident holds have no automatic expiry.

## Operation

The installed cron job is disarmed by default. A governed operator progresses
through a Metrics API baseline, count-only dry run, one 500-row canary, and a
rate-limited drain. The normal rate is at most 1,000 rows once per minute. Every
batch records exact sanitized coverage and resource effects.

The exact activation, canary, pause, hold, and completion sequence is in
[`docs/cron-history-retention-runbook.md`](../../docs/cron-history-retention-runbook.md).
