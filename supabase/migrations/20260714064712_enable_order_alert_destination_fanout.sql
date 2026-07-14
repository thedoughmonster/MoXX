-- service-owner: order-alerting

alter table momi_alerting.order_alert_candidates
  drop constraint order_alert_candidates_route_fk,
  drop constraint order_alert_candidates_order_kind_unique;

alter table momi_alerting.alert_routes
  drop constraint alert_routes_pkey,
  add constraint alert_routes_pkey
    primary key (source_key, alert_kind, destination_key);

insert into momi_alerting.alert_routes (
  source_key, alert_kind, destination_key, is_enabled
)
select distinct candidate.source_key, candidate.alert_kind,
  candidate.destination_key, false
from momi_alerting.order_alert_candidates as candidate
left join momi_alerting.alert_routes as route
  on route.source_key = candidate.source_key
  and route.alert_kind = candidate.alert_kind
  and route.destination_key = candidate.destination_key
where route.source_key is null
on conflict do nothing;

alter table momi_alerting.order_alert_candidates
  add constraint order_alert_candidates_route_fk
    foreign key (source_key, alert_kind, destination_key)
    references momi_alerting.alert_routes(
      source_key, alert_kind, destination_key
    ),
  add constraint order_alert_candidates_destination_unique
    unique (source_system, order_id, alert_kind, destination_key);
