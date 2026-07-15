-- service-owner: warehouse-projection
begin; lock table momi_warehouse.source_links, momi_warehouse.entity_versions, momi_warehouse.version_observations, momi_events.events in share row exclusive mode;
create temporary table legacy_entity_types on commit drop as
select link.entity_id, min(warehouse_projection.canonical_entity_type(link.resource_type)) expected_type, count(distinct warehouse_projection.canonical_entity_type(link.resource_type)) expected_type_count
from momi_warehouse.source_links link group by link.entity_id;
do $$ begin if exists (select 1 from legacy_entity_types where expected_type_count <> 1) then raise exception 'legacy_source_entity_type_conflict'; end if; end; $$;
update momi_warehouse.entities entity set entity_type = inferred.expected_type, updated_at = now()
from legacy_entity_types inferred where inferred.entity_id = entity.entity_id
  and entity.lifecycle_status = 'active' and entity.entity_type in ('menu_entity', 'stock_state')
  and entity.entity_type <> inferred.expected_type;
create temporary table legacy_identity_edges on commit drop as
select distinct restaurant.entity_id duplicate_id, location.entity_id canonical_id, 'location'::text entity_type
from momi_warehouse.source_links restaurant join momi_warehouse.source_links location
  on location.source_system = restaurant.source_system and location.resource_type = 'location' and location.source_location_id = ''
  and location.source_id = coalesce(nullif(restaurant.source_location_id, ''), restaurant.source_id)
where restaurant.source_system = 'toast' and restaurant.resource_type = 'restaurant' and restaurant.entity_id <> location.entity_id
union
select distinct stock.entity_id, item.entity_id, 'menu_item'::text
from momi_warehouse.source_links stock join momi_warehouse.source_links item
  on item.source_system = stock.source_system and item.resource_type = 'menu_item'
  and item.source_location_id = stock.source_location_id and item.source_id = stock.source_id
where stock.source_system = 'toast' and stock.resource_type = 'stock_state' and stock.entity_id <> item.entity_id;
do $$ begin if exists (
  select 1 from legacy_identity_edges group by duplicate_id
  having count(distinct canonical_id) <> 1 or count(distinct entity_type) <> 1
) or exists (
  select 1 from legacy_identity_edges edge join legacy_identity_edges next_edge
    on next_edge.duplicate_id = edge.canonical_id
  where next_edge.entity_type <> edge.entity_type
) then raise exception 'legacy_identity_merge_conflict'; end if; end; $$;
do $$ begin if exists (
  with recursive walk(origin_id, canonical_id, path, cycle) as (
    select duplicate_id, canonical_id, array[duplicate_id, canonical_id], duplicate_id = canonical_id from legacy_identity_edges
    union all
    select walk.origin_id, edge.canonical_id, walk.path || edge.canonical_id, edge.canonical_id = any(walk.path)
    from walk join legacy_identity_edges edge on edge.duplicate_id = walk.canonical_id where not walk.cycle
  ) select 1 from walk where cycle
) then raise exception 'legacy_identity_merge_cycle'; end if; end; $$;
create temporary table legacy_identity_merges on commit drop as with recursive walk(duplicate_id, canonical_id, entity_type) as (
  select duplicate_id, canonical_id, entity_type from legacy_identity_edges
  union all
  select walk.duplicate_id, edge.canonical_id, walk.entity_type
  from walk join legacy_identity_edges edge on edge.duplicate_id = walk.canonical_id
)
select walk.* from walk where not exists
  (select 1 from legacy_identity_edges edge where edge.duplicate_id = walk.canonical_id);
create temporary table legacy_version_plan on commit drop as
with targets as (
  select duplicate_id entity_id, canonical_id, true needs_move from legacy_identity_merges
  union all select distinct canonical_id, canonical_id, false from legacy_identity_merges
), candidates as (
  select version.*, target.canonical_id, target.needs_move,
    case when target.needs_move then jsonb_set(version.canonical_document, '{id}',
      to_jsonb(target.canonical_id), true) else version.canonical_document end target_document,
    exists (select 1 from momi_events.events event where event.source_reference @>
      jsonb_build_object('schema', 'momi_warehouse', 'table', 'entity_versions',
        'id', version.entity_version_id)) event_referenced
  from momi_warehouse.entity_versions version join targets target using (entity_id)
), hashed as (
  select candidate.*, encode(extensions.digest(target_document::text, 'sha256'), 'hex') target_hash
  from candidates candidate
), ranked as (
  select hashed.*, bool_or(needs_move) over version_group has_move,
    first_value(entity_version_id) over (
      version_group order by event_referenced desc, needs_move, entity_version_id
    ) survivor_id
  from hashed window version_group as (partition by canonical_id, source_system,
    source_resource_type, source_id, source_version_id, target_hash)
)
select * from ranked where has_move;
update momi_warehouse.entity_versions survivor
set source_observed_at = rollup.source_observed_at, projected_at = rollup.projected_at,
  provenance = rollup.latest_provenance || jsonb_build_object('identity_merge_versions',
    coalesce(rollup.latest_provenance -> 'identity_merge_versions', '[]'::jsonb) || rollup.history)
from (select survivor_id, max(source_observed_at) source_observed_at,
    min(projected_at) projected_at,
    (array_agg(provenance order by source_observed_at desc, entity_version_id))[1] latest_provenance,
    jsonb_agg(jsonb_build_object('entity_version_id', entity_version_id,
      'entity_id', entity_id, 'provenance', provenance) order by entity_version_id) history
  from legacy_version_plan group by survivor_id) rollup
where survivor.entity_version_id = rollup.survivor_id;
update momi_warehouse.version_observations observation set entity_version_id = plan.survivor_id
from legacy_version_plan plan where observation.entity_version_id = plan.entity_version_id
  and plan.entity_version_id <> plan.survivor_id and not plan.event_referenced;
delete from momi_warehouse.entity_versions version using legacy_version_plan plan
where version.entity_version_id = plan.entity_version_id
  and plan.entity_version_id <> plan.survivor_id and not plan.event_referenced;
update momi_warehouse.entity_versions version
set entity_id = plan.canonical_id, canonical_document = plan.target_document,
  content_hash = plan.target_hash
from legacy_version_plan plan where plan.entity_version_id = plan.survivor_id
  and plan.needs_move and version.entity_version_id = plan.entity_version_id;
delete from momi_warehouse.menu_universe_items duplicate using legacy_identity_merges merge
where duplicate.item_entity_id = merge.duplicate_id and exists (
  select 1 from momi_warehouse.menu_universe_items canonical
  where canonical.universe_version_id = duplicate.universe_version_id
    and canonical.item_entity_id = merge.canonical_id);
update momi_warehouse.menu_universe_items member set item_entity_id = merge.canonical_id
from legacy_identity_merges merge where member.item_entity_id = merge.duplicate_id;
update momi_warehouse.stock_observations observation set item_entity_id = merge.canonical_id
from legacy_identity_merges merge where merge.entity_type = 'menu_item' and observation.item_entity_id = merge.duplicate_id;
update momi_warehouse.stock_observations observation set location_entity_id = merge.canonical_id
from legacy_identity_merges merge where merge.entity_type = 'location' and observation.location_entity_id = merge.duplicate_id;
update momi_warehouse.menu_universe_versions universe set location_entity_id = merge.canonical_id
from legacy_identity_merges merge where merge.entity_type = 'location' and universe.location_entity_id = merge.duplicate_id;
update momi_warehouse.source_links link set entity_id = merge.canonical_id
from legacy_identity_merges merge where link.entity_id = merge.duplicate_id;
update momi_warehouse.entities entity set lifecycle_status = 'merged',
  merged_into_entity_id = merge.canonical_id, updated_at = now()
from legacy_identity_merges merge where entity.entity_id = merge.duplicate_id;
insert into momi_warehouse.source_links (source_system, resource_type, source_location_id,
  source_id, entity_id, first_observed_at, last_observed_at)
select source_system, 'menu_item', source_location_id, source_id, entity_id, first_observed_at, last_observed_at
from momi_warehouse.source_links where resource_type = 'stock_state' union all
select source_system, 'location', '', coalesce(nullif(source_location_id, ''), source_id), entity_id,
  first_observed_at, last_observed_at from momi_warehouse.source_links
where resource_type = 'restaurant' on conflict do nothing;
do $$ begin if exists (select 1 from momi_warehouse.source_links link join momi_warehouse.entities entity using (entity_id)
  where entity.lifecycle_status = 'active' and entity.entity_type <> warehouse_projection.canonical_entity_type(link.resource_type))
  then raise exception 'active_source_entity_type_conflict'; end if; end; $$; commit;
