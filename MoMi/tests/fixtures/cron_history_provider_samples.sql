-- Synthetic healthy history; the real provider-warning trigger and health gate run.
-- Queue observations are local fixtures, never live provider measurements.
create schema pgmq;
create function pgmq.metrics(queue_name text)
returns table (queue_length bigint, oldest_msg_age_sec numeric)
language sql as $$ select 0::bigint, null::numeric; $$;

insert into momi_cron_history.governor_ticks (tick_id, tick_status)
select ('00000000-0000-4000-8000-' || lpad(sample::text,12,'0'))::uuid, 'completed'
from generate_series(1,15) sample;
insert into momi_cron_history.health_samples (
  tick_id, source_observed_at, source_complete,
  cpu_total_seconds, cpu_idle_seconds, io_busy_seconds,
  cpu_pct, ram_pct, swap_used_bytes, io_pct, allocated_disk_pct,
  provider_connections, provider_warning, waiting_locks,
  active_vacuums, old_transactions, local_connections,
  order_alert_queue_length, order_alert_oldest_age,
  projection_queue_length, projection_oldest_age,
  order_alert_dlq_length, projection_dlq_length
)
select ('00000000-0000-4000-8000-' || lpad(sample::text,12,'0'))::uuid,
  now()-(16-sample)*interval '1 minute', true,
  sample*60, sample*54, 0, 10, 20, 0, 0, 20,
  1, false, 0, 0, 0, 1, 0, null, 0, null, 0, 0
from generate_series(1,15) sample;

insert into momi_cron_history.governor_ticks (
  tick_id, capability_token, tick_status, claimed_at
) values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000201', 'claimed', now()
);
