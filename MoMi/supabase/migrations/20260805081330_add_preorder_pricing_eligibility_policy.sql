-- service-owner: preorder-operations

alter table momi_preorder.configuration_publications
  drop constraint configuration_publications_schema_version_check;
alter table momi_preorder.configuration_publications
  add constraint configuration_publications_schema_version_check
  check (schema_version in (1, 2));

create table momi_preorder.configuration_price_classes (
  publication_id uuid not null references
    momi_preorder.configuration_publications(publication_id),
  price_class_key text not null
    check (price_class_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  label text not null check (length(label) between 1 and 120),
  currency text not null check (currency = 'USD'),
  preorder_price_minor integer not null check (preorder_price_minor > 0),
  price_floor_minor integer check (
    price_floor_minor >= 0 and price_floor_minor <= preorder_price_minor
  ),
  doughnut_price_class boolean not null,
  primary key (publication_id, price_class_key)
);

create table momi_preorder.configuration_item_policies (
  publication_id uuid not null references
    momi_preorder.configuration_publications(publication_id),
  item_id uuid not null,
  pricing_strategy text not null check (pricing_strategy in (
    'direct_class', 'highest_active_doughnut_class'
  )),
  declared_price_class_key text,
  resolved_price_class_key text not null,
  preorder_enabled boolean not null default false,
  eligibility_mode text not null check (eligibility_mode in (
    'always', 'starts_on', 'ends_on', 'date_range'
  )),
  eligible_from_date date,
  eligible_through_date date,
  primary key (publication_id, item_id),
  foreign key (publication_id, resolved_price_class_key)
    references momi_preorder.configuration_price_classes(
      publication_id, price_class_key
    ),
  check (
    (pricing_strategy = 'direct_class'
      and declared_price_class_key = resolved_price_class_key)
    or (pricing_strategy = 'highest_active_doughnut_class'
      and declared_price_class_key is null)
  ),
  check (
    (eligibility_mode = 'always'
      and eligible_from_date is null and eligible_through_date is null)
    or (eligibility_mode = 'starts_on'
      and eligible_from_date is not null and eligible_through_date is null)
    or (eligibility_mode = 'ends_on'
      and eligible_from_date is null and eligible_through_date is not null)
    or (eligibility_mode = 'date_range'
      and eligible_from_date is not null
      and eligible_through_date is not null
      and eligible_from_date <= eligible_through_date)
  )
);

alter table momi_preorder.catalog_items
  add column price_class_key text not null default 'legacy_direct'
    check (price_class_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  add column preorder_enabled boolean not null default true,
  add column eligibility_mode text not null default 'always'
    check (eligibility_mode in ('always', 'starts_on', 'ends_on', 'date_range')),
  add column eligible_from_date date,
  add column eligible_through_date date,
  add constraint catalog_item_eligibility_shape check (
    (eligibility_mode = 'always'
      and eligible_from_date is null and eligible_through_date is null)
    or (eligibility_mode = 'starts_on'
      and eligible_from_date is not null and eligible_through_date is null)
    or (eligibility_mode = 'ends_on'
      and eligible_from_date is null and eligible_through_date is not null)
    or (eligibility_mode = 'date_range'
      and eligible_from_date is not null
      and eligible_through_date is not null
      and eligible_from_date <= eligible_through_date)
  ),
  add constraint catalog_item_enabled_availability check (
    not available or preorder_enabled
  ) not valid;

alter table momi_preorder.configuration_price_classes enable row level security;
alter table momi_preorder.configuration_item_policies enable row level security;
revoke all on momi_preorder.configuration_price_classes
  from public, anon, authenticated, service_role;
revoke all on momi_preorder.configuration_item_policies
  from public, anon, authenticated, service_role;

create function momi_preorder.capture_configuration_authoring_v2()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_class jsonb;
  v_item jsonb;
  v_class_key text;
  v_highest_key text;
  v_highest_price integer;
  v_price integer;
  v_floor integer;
begin
  if new.schema_version <> 2 then return new; end if;
  if jsonb_typeof(new.configuration->'price_classes') <> 'array'
      or jsonb_array_length(new.configuration->'price_classes') = 0
      or jsonb_typeof(new.configuration->'catalog') <> 'array'
      or jsonb_array_length(new.configuration->'catalog') = 0 then
    raise exception 'version two preorder authoring policy is incomplete';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.configuration->'price_classes') value
    group by value->>'price_class_key' having count(*) > 1
  ) or exists (
    select 1 from jsonb_array_elements(new.configuration->'catalog') value
    group by value->>'item_id' having count(*) > 1
  ) then
    raise exception 'version two preorder authoring identity is duplicated';
  end if;
  for v_class in
    select value from jsonb_array_elements(new.configuration->'price_classes')
  loop
    insert into momi_preorder.configuration_price_classes (
      publication_id, price_class_key, label, currency,
      preorder_price_minor, price_floor_minor, doughnut_price_class
    ) values (
      new.publication_id, v_class->>'price_class_key', v_class->>'label',
      v_class->>'currency', (v_class->>'preorder_price_minor')::integer,
      (v_class->>'price_floor_minor')::integer,
      (v_class->>'doughnut_price_class')::boolean
    );
  end loop;
  select price_class_key, preorder_price_minor
    into v_highest_key, v_highest_price
    from momi_preorder.configuration_price_classes
    where publication_id = new.publication_id and doughnut_price_class
    order by preorder_price_minor desc, price_class_key
    limit 1;
  if v_highest_key is null or (
    select count(*) from momi_preorder.configuration_price_classes
    where publication_id = new.publication_id and doughnut_price_class
      and preorder_price_minor = v_highest_price
  ) <> 1 then
    raise exception 'exactly one highest doughnut price class is required';
  end if;
  for v_item in
    select value from jsonb_array_elements(new.configuration->'catalog')
  loop
    if v_item->>'pricing_strategy' = 'direct_class' then
      v_class_key := v_item->>'price_class_key';
    elsif v_item->>'pricing_strategy' = 'highest_active_doughnut_class'
        and v_item->>'price_class_key' is null then
      v_class_key := v_highest_key;
    else
      raise exception 'invalid preorder item pricing strategy';
    end if;
    select preorder_price_minor, price_floor_minor into v_price, v_floor
      from momi_preorder.configuration_price_classes
      where publication_id = new.publication_id
        and price_class_key = v_class_key;
    if not found
        or (v_item->>'preorder_price_minor')::integer is distinct from v_price
        or v_item->>'price_floor_minor' is distinct from v_floor::text then
      raise exception 'preorder item price does not match its class';
    end if;
    if new.publication_mode = 'active'
        and coalesce((v_item->>'available')::boolean, false)
        and not coalesce((v_item->>'preorder_enabled')::boolean, false) then
      raise exception 'available preorder item is administratively disabled';
    end if;
    insert into momi_preorder.configuration_item_policies (
      publication_id, item_id, pricing_strategy, declared_price_class_key,
      resolved_price_class_key, preorder_enabled, eligibility_mode,
      eligible_from_date, eligible_through_date
    ) values (
      new.publication_id, (v_item->>'item_id')::uuid,
      v_item->>'pricing_strategy', v_item->>'price_class_key', v_class_key,
      coalesce((v_item->>'preorder_enabled')::boolean, false),
      v_item->>'eligibility_mode',
      (v_item->>'eligible_from_date')::date,
      (v_item->>'eligible_through_date')::date
    );
  end loop;
  return new;
exception
  when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed or check_violation or foreign_key_violation then
    raise exception 'invalid version two preorder authoring policy';
end;
$$;

create trigger capture_configuration_authoring_v2
after insert on momi_preorder.configuration_publications
for each row execute function
  momi_preorder.capture_configuration_authoring_v2();

create function momi_preorder.apply_catalog_item_policy_v2()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_policy momi_preorder.configuration_item_policies%rowtype;
begin
  select policy.* into v_policy
    from momi_preorder.surfaces surface
    join momi_preorder.configuration_item_policies policy
      on policy.publication_id = surface.active_publication_id
    where surface.surface_id = new.surface_id
      and policy.item_id = new.item_id;
  if found then
    new.price_class_key := v_policy.resolved_price_class_key;
    new.preorder_enabled := v_policy.preorder_enabled;
    new.eligibility_mode := v_policy.eligibility_mode;
    new.eligible_from_date := v_policy.eligible_from_date;
    new.eligible_through_date := v_policy.eligible_through_date;
    new.available := new.available and v_policy.preorder_enabled;
  end if;
  return new;
end;
$$;

create trigger apply_catalog_item_policy_v2
before insert on momi_preorder.catalog_items
for each row execute function momi_preorder.apply_catalog_item_policy_v2();

create or replace function momi_preorder.publish_configuration_v1(
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
      and p_configuration->>'schema_version' is distinct from '2'
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
    v_surface_key, p_config_digest,
    (p_configuration->>'schema_version')::integer, v_mode,
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

create function momi_preorder.item_eligible_on_v1(
  p_preorder_enabled boolean,
  p_eligibility_mode text,
  p_eligible_from_date date,
  p_eligible_through_date date,
  p_fulfillment_date date
) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_preorder_enabled, false) and case p_eligibility_mode
    when 'always' then
      p_eligible_from_date is null and p_eligible_through_date is null
    when 'starts_on' then
      p_fulfillment_date is not null
      and p_eligible_from_date is not null
      and p_eligible_through_date is null
      and p_fulfillment_date >= p_eligible_from_date
    when 'ends_on' then
      p_fulfillment_date is not null
      and p_eligible_from_date is null
      and p_eligible_through_date is not null
      and p_fulfillment_date <= p_eligible_through_date
    when 'date_range' then
      p_fulfillment_date is not null
      and p_eligible_from_date is not null
      and p_eligible_through_date is not null
      and p_eligible_from_date <= p_eligible_through_date
      and p_fulfillment_date between
        p_eligible_from_date and p_eligible_through_date
    else false
  end
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
      'available', i.available and momi_preorder.item_eligible_on_v1(
        i.preorder_enabled, i.eligibility_mode, i.eligible_from_date,
        i.eligible_through_date, p_fulfillment_date),
      'maximum_quantity', i.maximum_quantity,
      'option_groups', i.option_groups, 'disclosures', i.disclosures)
      order by i.category_key, i.name, i.item_id)
      from momi_preorder.catalog_items i where i.surface_id = s.surface_id
        and i.catalog_version = s.catalog_version), '[]'::jsonb),
    'cancellation_policy', s.cancellation_policy,
    'fresh_at', now(), 'expires_at', now() + make_interval(secs => s.freshness_seconds))
  from momi_preorder.surfaces s where s.surface_key = p_surface_key and s.enabled
$$;

create or replace function momi_preorder.create_quote_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $quote$
declare
  v_command_id uuid := (p_request->>'command_id')::uuid;
  v_surface_id uuid := (p_request->>'surface_id')::uuid;
  v_window_id uuid := (p_request->>'fulfillment_window_id')::uuid;
  v_surface momi_preorder.surfaces%rowtype;
  v_window momi_preorder.fulfillment_windows%rowtype;
  v_existing momi_preorder.quotes%rowtype;
  v_line jsonb;
  v_item momi_preorder.catalog_items%rowtype;
  v_quantity integer;
  v_total_quantity integer := 0;
  v_quantity_discount integer := 0;
  v_notice_discount integer := 0;
  v_quantity_label text := 'Base';
  v_current_threshold integer := 0;
  v_next_label text;
  v_next_threshold integer;
  v_line_subtotal integer := 0;
  v_quantity_total integer := 0;
  v_final_total integer := 0;
  v_shop_total integer := 0;
  v_quantity_unit integer;
  v_final_unit integer;
  v_remaining integer;
  v_capacity_result text;
  v_expires_at timestamptz;
  v_quote_id uuid := gen_random_uuid();
  v_token text := replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '');
  v_quote jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('momi_preorder.create_quote_v1:' || v_command_id::text));
  v_existing := null;
  for v_existing in select * from momi_preorder.quotes
    where command_id = v_command_id loop exit; end loop;
  if v_existing.command_id is not null then
    if v_existing.request_snapshot is distinct from p_request then
      return momi_preorder.quote_failure_v1('conflict', 'stale_version',
        'This quote command was already used for different cart data.',
        false, 'requote');
    end if;
    return v_existing.response_snapshot;
  end if;
  if jsonb_typeof(p_request) <> 'object'
      or jsonb_array_length(p_request->'lines') not between 1 and 50
      or jsonb_typeof(p_request->'avoided_allergens') <> 'array' then
    return momi_preorder.quote_failure_v1('rejected', 'invalid_request',
      'The quote request is invalid.', false, 'none');
  end if;
  v_surface := null;
  for v_surface in select * from momi_preorder.surfaces
    where surface_id = v_surface_id and enabled for share loop exit; end loop;
  if v_surface.surface_id is null then
    return momi_preorder.quote_failure_v1('conflict', 'stale_version',
      'The preorder configuration changed.', true, 'refresh');
  end if;
  if (p_request->'versions'->>'surface_version')::integer <> v_surface.surface_version
      or (p_request->'versions'->>'catalog_version')::integer <> v_surface.catalog_version
      or (p_request->'versions'->>'policy_version')::integer <> v_surface.policy_version
      or (p_request->'versions'->>'mapping_version')::integer <> v_surface.mapping_version then
    return momi_preorder.quote_failure_v1('conflict', 'stale_version',
      'The preorder configuration changed.', true, 'refresh');
  end if;
  perform momi_preorder.ensure_fulfillment_windows_v1(v_surface.surface_id);
  v_window := null;
  for v_window in select * from momi_preorder.fulfillment_windows
    where window_id = v_window_id and surface_id = v_surface.surface_id
    for share loop exit; end loop;
  if v_window.window_id is null or not v_window.enabled or clock_timestamp() >= v_window.order_cutoff_at
      or v_window.fulfillment_date <
        (clock_timestamp() at time zone v_surface.timezone)::date
      or v_window.fulfillment_date >
        (clock_timestamp() at time zone v_surface.timezone)::date + 13 then
    return momi_preorder.quote_failure_v1('conflict', 'window_closed',
      'That pickup window is closed.', true, 'choose_another_window');
  end if;
  v_total_quantity := (select coalesce(
    sum((line->>'quantity')::integer), 0)
    from jsonb_array_elements(p_request->'lines') line);
  if v_total_quantity < 1 or exists (
    select 1 from jsonb_array_elements(p_request->'lines') line
    where (line->>'quantity')::integer not between 1 and 100
      or jsonb_array_length(line->'choice_ids') > 0
  ) or exists (
    select 1 from jsonb_array_elements(p_request->'lines') line
    group by line->>'line_id' having count(*) > 1
  ) then
    return momi_preorder.quote_failure_v1('rejected', 'invalid_request',
      'The cart contains an unsupported line.', false, 'none');
  end if;
  v_remaining := v_window.capacity_limit - v_window.held_quantity -
    v_window.committed_quantity;
  if v_total_quantity > v_remaining then
    return momi_preorder.quote_failure_v1('conflict', 'capacity_unavailable',
      'That pickup window no longer has enough capacity.', true,
      'choose_another_window');
  end if;
  for v_quantity_discount, v_quantity_label, v_current_threshold in
    select coalesce((level->>'discount_bps')::integer, 0), level->>'label',
      (level->>'minimum_quantity')::integer
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'quantity_levels') level
    where (level->>'minimum_quantity')::integer <= v_total_quantity
    order by (level->>'minimum_quantity')::integer desc limit 1
  loop exit; end loop;
  v_quantity_discount := coalesce(v_quantity_discount, 0);
  v_quantity_label := coalesce(v_quantity_label, 'Base');
  v_current_threshold := coalesce(v_current_threshold, 0);
  for v_next_label, v_next_threshold in
    select level->>'label', (level->>'minimum_quantity')::integer
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'quantity_levels') level
    where (level->>'minimum_quantity')::integer > v_total_quantity
    order by (level->>'minimum_quantity')::integer limit 1
  loop exit; end loop;
  for v_notice_discount in
    select coalesce((tier->>'multiplier_bps')::integer, 0)
    from jsonb_array_elements(
      v_surface.preorder_policy->'savings'->'advance_tiers') tier
    where (tier->>'minimum_days')::integer <= v_window.fulfillment_date -
      (clock_timestamp() at time zone v_surface.timezone)::date
    order by (tier->>'minimum_days')::integer desc limit 1
  loop exit; end loop;
  v_notice_discount := coalesce(v_notice_discount, 0);
  for v_line in select value from jsonb_array_elements(p_request->'lines') loop
    v_quantity := (v_line->>'quantity')::integer;
    v_item := null;
    for v_item in select * from momi_preorder.catalog_items
      where surface_id = v_surface.surface_id
        and catalog_version = v_surface.catalog_version
        and item_id = (v_line->>'item_id')::uuid loop exit; end loop;
    if v_item.item_id is null or not v_item.available
        or not momi_preorder.item_eligible_on_v1(
          v_item.preorder_enabled, v_item.eligibility_mode,
          v_item.eligible_from_date, v_item.eligible_through_date,
          v_window.fulfillment_date)
        or v_item.seasonal_eligibility <> 'eligible'
        or v_item.item_version <> (v_line->>'item_version')::integer
        or v_quantity > v_item.maximum_quantity then
      return momi_preorder.quote_failure_v1('rejected', 'item_unavailable',
        'A selected item is no longer available.', true,
        'choose_another_item');
    end if;
    if v_item.allergen_status = 'unverified'
        or (v_item.allergen_status = 'cross_contact_possible'
          and jsonb_array_length(p_request->'avoided_allergens') > 0)
        or v_item.allergens ?| array(select jsonb_array_elements_text(
          p_request->'avoided_allergens')) then
      return momi_preorder.quote_failure_v1('rejected', 'allergen_unverified',
        'A selected item conflicts with the allergen choices.', false,
        'choose_another_item');
    end if;
    v_quantity_unit := greatest(v_item.price_floor_minor,
      floor(v_item.base_price_minor * (10000 - v_quantity_discount) / 10000.0));
    v_final_unit := greatest(v_item.price_floor_minor,
      floor(v_quantity_unit * (10000 - v_notice_discount) / 10000.0));
    if v_final_unit >= v_item.shop_price_minor then
      return momi_preorder.quote_failure_v1('rejected', 'item_unavailable',
        'A selected item has no valid preorder price.', false, 'contact_shop');
    end if;
    v_line_subtotal := v_line_subtotal + v_item.base_price_minor * v_quantity;
    v_quantity_total := v_quantity_total + v_quantity_unit * v_quantity;
    v_final_total := v_final_total + v_final_unit * v_quantity;
    v_shop_total := v_shop_total + v_item.shop_price_minor * v_quantity;
  end loop;
  v_capacity_result := case
    when v_remaining - v_total_quantity <= v_window.limited_threshold
      then 'hold_required' else 'available' end;
  v_expires_at := least(clock_timestamp() + interval '5 minutes',
    v_window.order_cutoff_at);
  v_quote := jsonb_build_object(
    'quote_id', v_quote_id, 'quote_version', 1,
    'fulfillment_window_id', v_window.window_id,
    'line_subtotal', jsonb_build_object('currency', 'USD',
      'amount_minor', v_line_subtotal),
    'quantity_savings', jsonb_build_object('currency', 'USD',
      'amount_minor', v_line_subtotal - v_quantity_total),
    'notice_savings', jsonb_build_object('currency', 'USD',
      'amount_minor', v_quantity_total - v_final_total),
    'fees', jsonb_build_object('currency', 'USD', 'amount_minor', 0),
    'tax', jsonb_build_object('currency', 'USD', 'amount_minor', 0),
    'total', jsonb_build_object('currency', 'USD', 'amount_minor', v_final_total),
    'shop_comparison_total', jsonb_build_object('currency', 'USD',
      'amount_minor', v_shop_total),
    'preorder_savings_total', jsonb_build_object('currency', 'USD',
      'amount_minor', v_shop_total - v_final_total),
    'quantity_progress', jsonb_build_object(
      'current_level', v_quantity_label,
      'current_threshold', v_current_threshold,
      'current_discount_bps', v_quantity_discount,
      'next_level', v_next_label,
      'next_threshold', v_next_threshold,
      'quantity_needed', case when v_next_threshold is null then null
        else v_next_threshold - v_total_quantity end),
    'advance_discount_bps', v_notice_discount,
    'capacity_result', v_capacity_result,
    'versions', jsonb_build_object(
      'surface_version', v_surface.surface_version,
      'catalog_version', v_surface.catalog_version,
      'policy_version', v_surface.policy_version,
      'mapping_version', v_surface.mapping_version),
    'expires_at', v_expires_at, 'revalidation_token', v_token);
  insert into momi_preorder.quotes (
    quote_id, command_id, request_snapshot, response_snapshot, surface_id,
    fulfillment_window_id, surface_version, catalog_version, policy_version,
    mapping_version, cart_version, requested_quantity, line_subtotal_minor,
    quantity_savings_minor, notice_savings_minor, shop_comparison_minor,
    total_minor, capacity_result, expires_at
  ) values (v_quote_id, v_command_id, p_request,
    jsonb_build_object('outcome', 'accepted', 'quote', v_quote),
    v_surface.surface_id, v_window.window_id, v_surface.surface_version,
    v_surface.catalog_version, v_surface.policy_version,
    v_surface.mapping_version, (p_request->>'cart_version')::integer,
    v_total_quantity, v_line_subtotal, v_line_subtotal - v_quantity_total,
    v_quantity_total - v_final_total, v_shop_total, v_final_total,
    v_capacity_result, v_expires_at);
  return jsonb_build_object('outcome', 'accepted', 'quote', v_quote);
exception when invalid_text_representation or numeric_value_out_of_range
    or null_value_not_allowed then
  return momi_preorder.quote_failure_v1('rejected', 'invalid_request',
    'The quote request is invalid.', false, 'none');
end;
$quote$;

revoke all on function momi_preorder.capture_configuration_authoring_v2()
  from public, anon, authenticated, service_role;
revoke all on function momi_preorder.apply_catalog_item_policy_v2()
  from public, anon, authenticated, service_role;
revoke all on function momi_preorder.item_eligible_on_v1(
  boolean, text, date, date, date
) from public, anon, authenticated, service_role;
