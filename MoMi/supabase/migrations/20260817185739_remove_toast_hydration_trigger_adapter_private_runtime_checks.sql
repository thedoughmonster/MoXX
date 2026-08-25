-- service-owner: toast-order-hydration

create or replace function toast_hydration.enqueue_order_hydration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into toast_hydration.order_hydration_jobs (
    source_key,
    function_key,
    restaurant_guid,
    order_guid,
    requested_source_version,
    downstream_api_contract_key,
    raw_event_id
  )
  select
    mapping.source_key,
    mapping.function_key,
    extracted.restaurant_guid,
    extracted.order_guid,
    extracted.requested_source_version,
    mapping.downstream_api_contract_key,
    new.id
  from toast_hydration.webhook_order_mappings as mapping
  join toast_hydration.api_sources as source
    on source.source_key = mapping.source_key
    and source.is_enabled
  cross join lateral (
    select
      nullif(new.payload #>> mapping.restaurant_guid_path, '')
        as restaurant_guid,
      nullif(new.payload #>> mapping.order_guid_path, '')
        as order_guid,
      coalesce(
        nullif(new.payload #>> mapping.source_version_path, ''),
        nullif(new.payload #>> mapping.fallback_identity_path, '')
      ) as requested_source_version
  ) as extracted
  join toast_hydration.restaurants as restaurant
    on restaurant.source_key = mapping.source_key
    and restaurant.restaurant_guid = extracted.restaurant_guid
    and restaurant.is_enabled
  where mapping.is_enabled
    and new.payload #> mapping.event_type_path = mapping.expected_event_type
    and extracted.order_guid is not null
    and extracted.requested_source_version is not null
  on conflict (
    source_key,
    restaurant_guid,
    order_guid,
    requested_source_version
  ) do nothing;

  return new;
end;
$$;

create or replace function toast_hydration.wake_order_hydration_worker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  route_path constant text := '/functions/v1/toast-orders-fetch-by-guid-v1';
  project_url text;
  gateway_key text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key
  from vault.decrypted_secrets
  where name = 'momi_publishable_key';

  if project_url is null or gateway_key is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'job_id', new.id::text,
      'trigger_token', new.trigger_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;
