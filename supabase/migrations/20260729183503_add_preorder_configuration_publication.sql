-- service-owner: preorder-operations

alter table momi_preorder.surfaces
  add column active_publication_id uuid,
  add column preorder_policy jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preorder_policy) = 'object');

alter table momi_preorder.catalog_items
  add column category_key text not null default 'uncategorized'
    check (length(category_key) between 1 and 120),
  add column shop_price_minor integer check (shop_price_minor > 0),
  add column price_floor_minor integer check (price_floor_minor >= 0),
  add column allergens jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allergens) = 'array'),
  add constraint catalog_available_price_evidence check (
    not available or (
      shop_price_minor is not null and
      price_floor_minor is not null and
      price_floor_minor <= base_price_minor and
      base_price_minor < shop_price_minor
    )
  ) not valid;

create table momi_preorder.configuration_publications (
  publication_id uuid primary key default gen_random_uuid(),
  publication_ref uuid not null unique,
  surface_key text not null check (surface_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  config_digest text not null unique check (config_digest ~ '^[0-9a-f]{64}$'),
  schema_version integer not null check (schema_version = 1),
  publication_mode text not null check (publication_mode in ('draft', 'active')),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  actor_ref text not null check (length(actor_ref) between 1 and 120),
  resulting_version integer check (resulting_version > 0),
  created_at timestamptz not null default now()
);

alter table momi_preorder.surfaces
  add constraint surfaces_active_publication_id_fkey
  foreign key (active_publication_id)
  references momi_preorder.configuration_publications(publication_id);

alter table momi_preorder.configuration_publications enable row level security;
revoke all on momi_preorder.configuration_publications
  from public, anon, authenticated, service_role;

create function momi_preorder.publish_configuration_v1(
  p_configuration jsonb, p_config_digest text, p_actor_ref text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_mode text := p_configuration->>'publication_mode';
  v_surface jsonb := p_configuration->'surface';
  v_surface_key text := v_surface->>'surface_key';
  v_publication_id uuid;
  v_version integer;
  v_existing uuid;
  v_existing_configuration jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('momi_preorder.publish_configuration_v1:digest:' ||
      coalesce(p_config_digest, ''))
  );
  select publication_id, configuration
    into v_existing, v_existing_configuration
    from momi_preorder.configuration_publications
    where config_digest = p_config_digest;
  if v_existing is not null then
    if v_existing_configuration is distinct from p_configuration then
      raise exception 'preorder configuration digest collision';
    end if;
    return jsonb_build_object('publication_id', v_existing,
      'publication_ref', v_existing_configuration->>'publication_ref',
      'config_digest', p_config_digest, 'replayed', true);
  end if;
  if p_configuration->>'schema_version' is distinct from '1'
      or p_configuration->>'publication_ref' is null
      or v_mode is null
      or v_mode not in ('draft', 'active')
      or v_surface_key is null
      or v_surface_key !~ '^[a-z][a-z0-9_-]{1,63}$'
      or p_config_digest is null
      or p_config_digest !~ '^[0-9a-f]{64}$'
      or p_actor_ref is null
      or length(trim(p_actor_ref)) not between 1 and 120 then
    raise exception 'invalid preorder configuration publication';
  end if;
  if v_mode = 'active' and coalesce((v_surface->>'enabled')::boolean, false) is false then
    raise exception 'active preorder configuration must enable its surface';
  end if;
  if v_mode = 'active' then
    if p_configuration->'pickup_policy'->>'horizon_days' is distinct from '14'
        or p_configuration->'pickup_policy'->>'cutoff_hours' is null
        or p_configuration->'capacity_policy'->>'daily_limit' is null
        or p_configuration->'capacity_policy'->>'limited_threshold' is null
        or (p_configuration->'capacity_policy'->>'limited_threshold')::integer >
          (p_configuration->'capacity_policy'->>'daily_limit')::integer then
      raise exception 'active preorder configuration lacks pickup or capacity policy';
    end if;
    if coalesce(jsonb_array_length(p_configuration->'savings_policy'->'advance_tiers'), 0) <> 3
        or (select array_agg((tier->>'minimum_days')::integer order by
          (tier->>'minimum_days')::integer)
          from jsonb_array_elements(p_configuration->'savings_policy'->'advance_tiers') tier)
          is distinct from array[2, 5, 10]
        or exists (select 1
          from jsonb_array_elements(p_configuration->'savings_policy'->'advance_tiers') tier
          where tier->>'multiplier_bps' is null)
        or coalesce(jsonb_array_length(p_configuration->'savings_policy'->'quantity_levels'), 0) = 0
        or exists (select 1
          from jsonb_array_elements(p_configuration->'savings_policy'->'quantity_levels') level
          where level->>'discount_bps' is null) then
      raise exception 'active preorder configuration lacks savings policy';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(p_configuration->'catalog') item
      where coalesce((item->>'available')::boolean, false)
    ) then
      raise exception 'active preorder configuration has no available item';
    end if;
    if exists (
      select item->>'item_id'
      from jsonb_array_elements(p_configuration->'catalog') item
      group by item->>'item_id' having count(*) > 1
    ) then
      raise exception 'preorder configuration has duplicate catalog item';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_configuration->'catalog') item
      where coalesce((item->>'available')::boolean, false)
        and (item->>'allergen_status' = 'unverified'
          or item->>'preorder_price_minor' is null
          or item->>'price_floor_minor' is null
          or (item->>'price_floor_minor')::integer >
            (item->>'preorder_price_minor')::integer
          or (item->>'preorder_price_minor')::integer >=
            (item->>'shop_price_minor')::integer
          or coalesce((item->>'maximum_quantity')::integer, 0) < 1)
    ) then
      raise exception 'active preorder configuration has unsafe available item';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('momi_preorder.publish_configuration_v1:' || v_surface_key)
    );
    if exists (
      select 1 from momi_preorder.surfaces
      where surface_key = v_surface_key
        and surface_id <> (v_surface->>'surface_id')::uuid
    ) then
      raise exception 'preorder surface identity cannot change';
    end if;
  end if;
  insert into momi_preorder.configuration_publications (
    publication_ref, surface_key, config_digest, schema_version, publication_mode,
    configuration, actor_ref
  ) values ((p_configuration->>'publication_ref')::uuid,
    v_surface_key, p_config_digest, 1, v_mode,
    p_configuration, trim(p_actor_ref))
  returning publication_id into v_publication_id;
  if v_mode = 'draft' then
    return jsonb_build_object('publication_id', v_publication_id,
      'publication_ref', p_configuration->>'publication_ref',
      'config_digest', p_config_digest, 'mode', v_mode,
      'surface_key', v_surface_key, 'replayed', false);
  end if;
  select coalesce(surface_version, 0) + 1 into v_version
    from momi_preorder.surfaces where surface_key = v_surface_key;
  v_version := coalesce(v_version, 1);
  insert into momi_preorder.surfaces (
    surface_id, surface_key, location_id, location_name, timezone,
    surface_version, catalog_version, policy_version, mapping_version,
    cancellation_policy, freshness_seconds, published_at, enabled,
    active_publication_id, preorder_policy
  ) values (
    (v_surface->>'surface_id')::uuid, v_surface_key,
    (v_surface->>'location_id')::uuid, v_surface->>'location_name',
    v_surface->>'timezone', v_version, v_version, v_version, v_version,
    v_surface->'cancellation_policy', (v_surface->>'freshness_seconds')::integer,
    now(), true, v_publication_id,
    jsonb_build_object('pickup', p_configuration->'pickup_policy',
      'savings', p_configuration->'savings_policy',
      'capacity', p_configuration->'capacity_policy',
      'feature_flags', p_configuration->'feature_flags')
  ) on conflict (surface_key) do update set
    location_id = excluded.location_id,
    location_name = excluded.location_name,
    timezone = excluded.timezone,
    surface_version = excluded.surface_version,
    catalog_version = excluded.catalog_version,
    policy_version = excluded.policy_version,
    mapping_version = excluded.mapping_version,
    cancellation_policy = excluded.cancellation_policy,
    freshness_seconds = excluded.freshness_seconds,
    published_at = excluded.published_at,
    enabled = excluded.enabled,
    active_publication_id = excluded.active_publication_id,
    preorder_policy = excluded.preorder_policy;
  insert into momi_preorder.catalog_items (
    surface_id, catalog_version, item_id, item_version, category_key,
    name, description, currency, base_price_minor, shop_price_minor,
    price_floor_minor, media, allergens, allergen_status,
    seasonal_eligibility, available, maximum_quantity,
    option_groups, disclosures
  ) select (v_surface->>'surface_id')::uuid, v_version,
    (item->>'item_id')::uuid, (item->>'item_version')::integer,
    item->>'category', item->>'name', item->>'description',
    item->>'currency', coalesce((item->>'preorder_price_minor')::integer, 0),
    (item->>'shop_price_minor')::integer,
    (item->>'price_floor_minor')::integer,
    item->'media', item->'allergens', item->>'allergen_status',
    item->>'seasonal_eligibility', (item->>'available')::boolean,
    (item->>'maximum_quantity')::integer, item->'option_groups',
    item->'disclosures'
  from jsonb_array_elements(p_configuration->'catalog') item
  where coalesce((item->>'available')::boolean, false);
  update momi_preorder.configuration_publications
    set resulting_version = v_version where publication_id = v_publication_id;
  return jsonb_build_object('publication_id', v_publication_id,
    'publication_ref', p_configuration->>'publication_ref',
    'config_digest', p_config_digest, 'mode', v_mode,
    'surface_key', v_surface_key, 'resulting_version', v_version,
    'configured_catalog_items', jsonb_array_length(p_configuration->'catalog'),
    'published_catalog_items', (select count(*)
      from jsonb_array_elements(p_configuration->'catalog') item
      where coalesce((item->>'available')::boolean, false)),
    'replayed', false);
end;
$$;

create or replace function momi_preorder.read_bootstrap_v1(
  p_surface_key text, p_fulfillment_date date default null
) returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'surface_id', s.surface_id, 'surface_key', s.surface_key,
    'location_id', s.location_id, 'location_name', s.location_name,
    'timezone', s.timezone,
    'versions', jsonb_build_object('surface_version', s.surface_version,
      'catalog_version', s.catalog_version, 'policy_version', s.policy_version,
      'mapping_version', s.mapping_version),
    'fulfillment_windows', coalesce((select jsonb_agg(jsonb_build_object(
      'window_id', w.window_id, 'date', to_char(w.fulfillment_date, 'YYYY-MM-DD'),
      'starts_at', w.starts_at, 'ends_at', w.ends_at,
      'order_cutoff_at', w.order_cutoff_at,
      'availability', case when not w.enabled or now() >= w.order_cutoff_at then 'closed'
        when w.held_quantity + w.committed_quantity >= w.capacity_limit then 'sold_out'
        when w.capacity_limit - w.held_quantity - w.committed_quantity <= w.limited_threshold then 'limited'
        else 'available' end) order by w.starts_at)
      from momi_preorder.fulfillment_windows w where w.surface_id = s.surface_id
        and ((p_fulfillment_date is not null and w.fulfillment_date = p_fulfillment_date)
          or (p_fulfillment_date is null and w.fulfillment_date between
            (now() at time zone s.timezone)::date and
            (now() at time zone s.timezone)::date + 30))), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(jsonb_build_object(
      'item_id', i.item_id, 'item_version', i.item_version,
      'category', i.category_key, 'name', i.name, 'description', i.description,
      'base_price', jsonb_build_object('currency', i.currency, 'amount_minor', i.base_price_minor),
      'shop_price', case when i.shop_price_minor is null then null else
        jsonb_build_object('currency', i.currency, 'amount_minor', i.shop_price_minor) end,
      'price_floor', case when i.price_floor_minor is null then null else
        jsonb_build_object('currency', i.currency, 'amount_minor', i.price_floor_minor) end,
      'media', i.media, 'allergens', i.allergens,
      'allergen_status', i.allergen_status,
      'seasonal_eligibility', i.seasonal_eligibility,
      'available', i.available, 'maximum_quantity', i.maximum_quantity,
      'option_groups', i.option_groups, 'disclosures', i.disclosures)
      order by i.category_key, i.name, i.item_id)
      from momi_preorder.catalog_items i where i.surface_id = s.surface_id
        and i.catalog_version = s.catalog_version), '[]'::jsonb),
    'cancellation_policy', s.cancellation_policy,
    'fresh_at', now(), 'expires_at', now() + make_interval(secs => s.freshness_seconds))
  from momi_preorder.surfaces s where s.surface_key = p_surface_key and s.enabled
$$;

revoke all on function momi_preorder.publish_configuration_v1(jsonb, text, text)
  from public, anon, authenticated, service_role;
grant execute on function momi_preorder.publish_configuration_v1(jsonb, text, text)
  to service_role;
