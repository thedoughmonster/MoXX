create schema if not exists toast_alerting;

comment on schema toast_alerting is
  'Private Toast alert eligibility configuration and candidate claims.';

revoke all on schema toast_alerting from public, anon, authenticated;

create table toast_alerting.toast_sources (
  source_key text primary key,
  display_name text not null default '',
  payload_path text[] not null,
  expected_value jsonb not null,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint toast_sources_source_key_is_present
    check (nullif(source_key, '') is not null),
  constraint toast_sources_payload_path_is_present
    check (array_length(payload_path, 1) > 0)
);

create table toast_alerting.slack_destinations (
  destination_key text primary key,
  slack_channel_id text not null,
  display_name text not null default '',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint slack_destinations_key_is_present
    check (nullif(destination_key, '') is not null),
  constraint slack_destinations_channel_is_present
    check (nullif(slack_channel_id, '') is not null)
);

create table toast_alerting.alert_rules (
  id bigint generated always as identity primary key,
  source_key text not null references toast_alerting.toast_sources(source_key),
  alert_kind text not null,
  rule_version integer not null default 1,
  description text not null default '',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint alert_rules_alert_kind_is_present
    check (nullif(alert_kind, '') is not null),
  constraint alert_rules_rule_version_is_positive
    check (rule_version > 0),
  constraint alert_rules_source_kind_version_unique
    unique (source_key, alert_kind, rule_version)
);

create table toast_alerting.alert_rule_conditions (
  id bigint generated always as identity primary key,
  rule_id bigint not null references toast_alerting.alert_rules(id) on delete cascade,
  condition_index integer not null,
  payload_path text[] not null,
  expected_value jsonb not null,
  created_at timestamptz not null default now(),
  constraint alert_rule_conditions_index_is_positive
    check (condition_index > 0),
  constraint alert_rule_conditions_payload_path_is_present
    check (array_length(payload_path, 1) > 0),
  constraint alert_rule_conditions_rule_index_unique
    unique (rule_id, condition_index)
);

create table toast_alerting.alert_routes (
  source_key text not null references toast_alerting.toast_sources(source_key),
  alert_kind text not null,
  destination_key text not null references toast_alerting.slack_destinations(destination_key),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (source_key, alert_kind),
  constraint alert_routes_alert_kind_is_present
    check (nullif(alert_kind, '') is not null)
);

create table toast_alerting.order_alert_candidates (
  id bigint generated always as identity primary key,
  claimed_at timestamptz not null default now(),
  toast_order_guid text not null,
  source_key text not null,
  alert_kind text not null,
  destination_key text not null,
  raw_event_id bigint not null references toast_raw.order_webhook_events(id),
  rule_id bigint not null references toast_alerting.alert_rules(id),
  rule_version integer not null,
  decision_context jsonb not null default '{}'::jsonb,
  constraint order_alert_candidates_order_guid_is_present
    check (nullif(toast_order_guid, '') is not null),
  constraint order_alert_candidates_context_is_object
    check (jsonb_typeof(decision_context) = 'object'),
  constraint order_alert_candidates_rule_version_is_positive
    check (rule_version > 0),
  constraint order_alert_candidates_order_kind_unique
    unique (toast_order_guid, alert_kind),
  constraint order_alert_candidates_route_fk
    foreign key (source_key, alert_kind)
    references toast_alerting.alert_routes(source_key, alert_kind),
  constraint order_alert_candidates_destination_fk
    foreign key (destination_key)
    references toast_alerting.slack_destinations(destination_key)
);

alter table toast_alerting.toast_sources enable row level security;
alter table toast_alerting.slack_destinations enable row level security;
alter table toast_alerting.alert_rules enable row level security;
alter table toast_alerting.alert_rule_conditions enable row level security;
alter table toast_alerting.alert_routes enable row level security;
alter table toast_alerting.order_alert_candidates enable row level security;

revoke all on all tables in schema toast_alerting
  from public, anon, authenticated;

revoke all on all sequences in schema toast_alerting
  from public, anon, authenticated;

alter default privileges in schema toast_alerting
  revoke all on tables from public, anon, authenticated;

alter default privileges in schema toast_alerting
  revoke all on sequences from public, anon, authenticated;
