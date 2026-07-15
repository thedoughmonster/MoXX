-- service-owner: toast-data-acquisition

insert into toast_acquisition.jobs (
  operation_key, source_key, restaurant_guid, mode, parameters,
  reason, correlation_id, idempotency_key, next_attempt_at
)
select operation.operation_key, restaurant.source_key,
  restaurant.restaurant_guid, 'snapshot',
  jsonb_build_object(
    'restaurantGUID', restaurant.restaurant_guid,
    'includeArchived', true
  ),
  'Capture Toast firstBusinessDate before historical archive activation',
  gen_random_uuid(),
  'toast.restaurant.backfill-anchor.v1:' || restaurant.source_key || ':'
    || restaurant.restaurant_guid,
  now()
from toast_acquisition.restaurants as restaurant
join toast_acquisition.operations as operation
  on operation.operation_key = 'toast.restaurants.get.v1'
  and operation.source_operation_id = 'restaurantsRestaurantGuidGet'
  and operation.response_kind = 'document'
  and not operation.exact_resource_only
  and operation.is_enabled
where restaurant.is_enabled
on conflict (idempotency_key) do nothing;

do $$
begin
  if exists (
    select 1 from toast_acquisition.restaurants as restaurant
    where restaurant.is_enabled and not exists (
      select 1 from toast_acquisition.jobs as job
      where job.idempotency_key =
        'toast.restaurant.backfill-anchor.v1:' || restaurant.source_key || ':'
          || restaurant.restaurant_guid
        and job.operation_key = 'toast.restaurants.get.v1'
        and job.mode = 'snapshot'
    )
  ) then raise exception 'Restaurant backfill anchor was not enqueued'; end if;
  if (select count(*) from cron.job
    where jobname = 'momi-toast-acquisition-wakeup-v1'
      and active and schedule = '15 seconds') <> 1
  then raise exception 'Paced acquisition recovery is not active'; end if;
end;
$$;
