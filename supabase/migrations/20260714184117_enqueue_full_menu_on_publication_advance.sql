-- service-owner: toast-data-acquisition

create table toast_acquisition.menu_publication_state (
  source_key text not null default 'toast',
  restaurant_guid text not null,
  latest_published_at timestamptz not null,
  latest_source_kind text not null,
  latest_correlation_id uuid not null,
  latest_job_id bigint references toast_acquisition.jobs(job_id),
  updated_at timestamptz not null default now(),
  primary key (source_key, restaurant_guid),
  foreign key (source_key, restaurant_guid)
    references toast_acquisition.restaurants(source_key, restaurant_guid)
);

create function toast_acquisition.enqueue_menu_publication(
  p_restaurant_guid text,
  p_published_at text,
  p_source_kind text,
  p_correlation_id uuid,
  p_reason text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  published_at timestamptz;
  changed boolean;
  enqueued_job_id bigint;
  job_key text;
begin
  if p_published_at is null
    or not pg_input_is_valid(p_published_at, 'timestamptz') then
    return 'ignored_invalid_publication_timestamp';
  end if;
  if not exists (
    select 1 from toast_acquisition.restaurants as restaurant
    join toast_acquisition.operations as operation
      on operation.operation_key = 'toast.menus.full.v1'
    where restaurant.source_key = 'toast'
      and restaurant.restaurant_guid = p_restaurant_guid
      and restaurant.is_enabled and operation.is_enabled
  ) then return 'ignored_disabled_restaurant_or_operation'; end if;
  published_at := p_published_at::timestamptz;
  insert into toast_acquisition.menu_publication_state (
    source_key, restaurant_guid, latest_published_at, latest_source_kind,
    latest_correlation_id
  ) values (
    'toast', p_restaurant_guid, published_at, p_source_kind, p_correlation_id
  ) on conflict (source_key, restaurant_guid) do update
  set latest_published_at = excluded.latest_published_at,
      latest_source_kind = excluded.latest_source_kind,
      latest_correlation_id = excluded.latest_correlation_id,
      updated_at = now()
  where toast_acquisition.menu_publication_state.latest_published_at
    < excluded.latest_published_at
  returning true into changed;
  if not coalesce(changed, false) then return 'publication_not_advanced'; end if;
  job_key := 'toast:menu-publication:' || p_restaurant_guid || ':'
    || extract(epoch from published_at)::text;
  insert into toast_acquisition.jobs (
    operation_key, source_key, restaurant_guid, mode, reason,
    correlation_id, idempotency_key
  ) values (
    'toast.menus.full.v1', 'toast', p_restaurant_guid, 'live', p_reason,
    p_correlation_id, job_key
  ) on conflict (idempotency_key) do update
  set idempotency_key = excluded.idempotency_key
  returning job_id into enqueued_job_id;
  update toast_acquisition.menu_publication_state
  set latest_job_id = enqueued_job_id
  where source_key = 'toast' and restaurant_guid = p_restaurant_guid;
  return 'menu_refresh_enqueued';
end;
$$;

create function toast_acquisition.enqueue_menu_metadata_refresh()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare source_version toast_raw.resource_versions;
begin
  select * into strict source_version from toast_raw.resource_versions
  where resource_version_id = new.resource_version_id;
  if source_version.resource_type = 'menu_metadata' then
    perform toast_acquisition.enqueue_menu_publication(
      source_version.restaurant_guid,
      source_version.payload ->> 'lastUpdated', 'metadata_poll',
      new.correlation_id,
      'Menu metadata publication advanced'
    );
  end if;
  return new;
end;
$$;

create trigger enqueue_menu_metadata_refresh
after insert on toast_raw.resource_observations
for each row execute function toast_acquisition.enqueue_menu_metadata_refresh();

alter table toast_acquisition.menu_publication_state enable row level security;
revoke all on table toast_acquisition.menu_publication_state
  from public, anon, authenticated;
revoke all on function toast_acquisition.enqueue_menu_publication(
  text, text, text, uuid, text
) from public, anon, authenticated;
revoke all on function toast_acquisition.enqueue_menu_metadata_refresh()
  from public, anon, authenticated;
