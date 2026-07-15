-- service-owner: toast-data-acquisition

create function toast_acquisition.sync_ordering_schedule_raw_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  raw_row jsonb := to_jsonb(new);
  source_table text := tg_table_schema || '.' || tg_table_name;
  source_record_id text;
  processing_stage text;
  restaurant_guid text;
  schedule jsonb;
  observed_at timestamptz;
  source_kind text;
begin
  if tg_table_name = 'resource_versions' then
    if raw_row ->> 'resource_type' <> 'ordering_schedule' then return new; end if;
    source_table := 'toast_raw.resource_versions';
    source_record_id := raw_row ->> 'resource_version_id';
    processing_stage := 'sync_ordering_schedule_resource';
    restaurant_guid := raw_row ->> 'restaurant_guid';
    schedule := raw_row -> 'payload';
    observed_at := (raw_row ->> 'retrieved_at')::timestamptz;
    source_kind := 'toast_api';
  elsif tg_table_name = 'webhook_events' then
    if raw_row ->> 'subscription_key' <> 'ordering-schedule' then return new; end if;
    source_table := 'toast_raw.webhook_events';
    source_record_id := raw_row ->> 'id';
    processing_stage := 'sync_ordering_schedule_webhook';
    restaurant_guid := coalesce(raw_row ->> 'restaurant_guid', raw_row #>> '{payload,details,restaurantGuid}');
    schedule := raw_row #> '{payload,details,orderingSchedule}';
    observed_at := (raw_row ->> 'received_at')::timestamptz;
    source_kind := 'toast_webhook';
  else
    return new;
  end if;
  perform toast_acquisition.sync_online_ordering_hours(
    restaurant_guid, schedule, observed_at, source_kind
  );
  return new;
exception when others then
  begin
    insert into toast_acquisition.raw_processing_failures (
      source_table, source_record_id, processing_stage, restaurant_guid, error_sqlstate, error_message
    ) values (source_table, source_record_id, processing_stage, restaurant_guid, sqlstate, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;

create function toast_acquisition.resync_ordering_schedule_policy()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  archive_table text;
  archive_id text;
  archive_schedule jsonb;
  archive_observed_at timestamptz;
  archive_kind text;
begin
  select source_table, source_record_id, schedule, observed_at, source_kind
  into archive_table, archive_id, archive_schedule, archive_observed_at, archive_kind
  from (
    select 'toast_raw.resource_observations'::text as source_table,
      observation.observation_id::text as source_record_id,
      version.payload as schedule, observation.observed_at, 'toast_api'::text as source_kind
    from toast_raw.resource_observations as observation
    join toast_raw.resource_versions as version using (resource_version_id)
    where version.resource_type = 'ordering_schedule'
      and version.restaurant_guid = new.restaurant_guid
    union all
    select 'toast_raw.webhook_events', webhook.id::text,
      webhook.payload #> '{details,orderingSchedule}', webhook.received_at, 'toast_webhook'
    from toast_raw.webhook_events as webhook
    where webhook.subscription_key = 'ordering-schedule'
      and coalesce(webhook.restaurant_guid,
        webhook.payload #>> '{details,restaurantGuid}') = new.restaurant_guid
  ) as archived
  where schedule is not null
  order by observed_at desc, source_table, source_record_id desc
  limit 1;
  if not found then return new; end if;
  perform toast_acquisition.sync_online_ordering_hours(
    new.restaurant_guid, archive_schedule, archive_observed_at, archive_kind
  );
  return new;
exception when others then
  begin
    insert into toast_acquisition.raw_processing_failures (
      source_table, source_record_id, processing_stage, restaurant_guid,
      error_sqlstate, error_message
    ) values (coalesce(archive_table, 'toast_acquisition.capture_window_policies'),
      coalesce(archive_id, new.restaurant_guid || ':' || new.day_of_week::text),
      'resync_ordering_schedule_policy', new.restaurant_guid, sqlstate, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;

create trigger sync_ordering_schedule_resource after insert on toast_raw.resource_versions
for each row execute function toast_acquisition.sync_ordering_schedule_raw_row();
create trigger sync_ordering_schedule_webhook after insert on toast_raw.webhook_events
for each row execute function toast_acquisition.sync_ordering_schedule_raw_row();
create trigger resync_ordering_schedule_policy
after insert or update on toast_acquisition.capture_window_policies
for each row execute function toast_acquisition.resync_ordering_schedule_policy();

-- Replay runtime policies that may predate this trigger without changing them.
update toast_acquisition.capture_window_policies set active = active;

revoke all on function toast_acquisition.sync_ordering_schedule_raw_row() from public, anon, authenticated;
revoke all on function toast_acquisition.resync_ordering_schedule_policy() from public, anon, authenticated;
