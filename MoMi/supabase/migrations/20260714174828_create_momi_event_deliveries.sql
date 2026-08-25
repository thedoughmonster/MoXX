-- service-owner: momi-event-routing

create table momi_events.subscriptions (
  subscription_key text primary key,
  consumer_service text not null,
  event_pattern text not null,
  queue_name text not null unique,
  dead_letter_queue_name text not null unique,
  active boolean not null default false,
  minimum_recorded_at timestamptz not null default '-infinity',
  created_at timestamptz not null default now(),
  constraint subscriptions_key_present
    check (nullif(subscription_key, '') is not null),
  constraint subscriptions_pattern_valid
    check (event_pattern like 'source.%' or event_pattern like 'warehouse.%'),
  constraint subscriptions_queue_valid
    check (queue_name ~ '^[a-z0-9_]+$'),
  constraint subscriptions_dlq_valid
    check (dead_letter_queue_name ~ '^[a-z0-9_]+$')
);

create table momi_events.routing_work (
  event_id uuid primary key references momi_events.events(event_id),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  capability_token uuid not null default gen_random_uuid(),
  completed_at timestamptz,
  last_error text,
  constraint routing_work_status_valid check (
    status in ('pending', 'running', 'retry_wait', 'succeeded', 'dead_letter')
  ),
  constraint routing_work_attempts_valid
    check (attempt_count between 0 and 12)
);

create table momi_events.deliveries (
  event_id uuid not null references momi_events.events(event_id),
  subscription_key text not null
    references momi_events.subscriptions(subscription_key),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  queue_message_id bigint,
  capability_token uuid not null default gen_random_uuid(),
  last_error text,
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  primary key (event_id, subscription_key),
  constraint deliveries_status_valid check (
    status in ('pending', 'queued', 'running', 'retry_wait', 'delivered', 'dead_letter')
  ),
  constraint deliveries_attempts_valid
    check (attempt_count between 0 and 12)
);

create index routing_work_claim_idx on momi_events.routing_work (
  status, next_attempt_at, lease_expires_at
);
create index deliveries_retry_idx on momi_events.deliveries (
  status, next_attempt_at
) where status in ('pending', 'retry_wait');

alter table momi_events.subscriptions enable row level security;
alter table momi_events.routing_work enable row level security;
alter table momi_events.deliveries enable row level security;
revoke all on all tables in schema momi_events
  from public, anon, authenticated;

select pgmq.create('order_alerting_v1');
select pgmq.create('order_alerting_v1_dead_letter');
select pgmq.create('warehouse_projection_toast_v1');
select pgmq.create('warehouse_projection_toast_v1_dead_letter');

insert into momi_events.subscriptions (
  subscription_key, consumer_service, event_pattern,
  queue_name, dead_letter_queue_name, active, minimum_recorded_at
) values (
  'order-alerting-v1', 'order-alerting', 'warehouse.order.%',
  'order_alerting_v1', 'order_alerting_v1_dead_letter', false, 'infinity'
), (
  'warehouse-projection-toast-v1', 'warehouse-projection', 'source.toast.%',
  'warehouse_projection_toast_v1',
  'warehouse_projection_toast_v1_dead_letter', false, '-infinity'
);
