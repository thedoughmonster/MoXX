-- service-owner: toast-data-acquisition

update momi_runtime.function_registry
set active = true
where function_key = 'toast.data.acquisition.v1'
  and owner_service = 'toast-data-acquisition';

update momi_runtime.function_trigger_registry
set active = true
where trigger_key = 'toast.data.acquisition.http.v1'
  and function_key = 'toast.data.acquisition.v1'
  and owner_service = 'toast-data-acquisition';

select cron.alter_job(job_id := jobid, active := true)
from cron.job
where jobname = 'momi-toast-acquisition-wakeup-v1';

insert into toast_acquisition.jobs (
  operation_key, source_key, restaurant_guid, mode, parameters,
  reason, correlation_id, idempotency_key
)
select
  'toast.ordering_schedule.snapshot.v1', restaurant.source_key,
  restaurant.restaurant_guid, 'snapshot', '{}'::jsonb,
  'Bootstrap online-ordering capture window from Toast', gen_random_uuid(),
  'bootstrap:toast.ordering_schedule.snapshot.v1:'
    || restaurant.restaurant_guid
from toast_acquisition.restaurants as restaurant
join toast_acquisition.sources as source using (source_key)
join toast_acquisition.operations as operation
  on operation.operation_key = 'toast.ordering_schedule.snapshot.v1'
where restaurant.is_enabled and source.is_enabled and operation.is_enabled
on conflict (idempotency_key) do nothing;

do $$
begin
  if not exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'toast.data.acquisition.v1' and active
  ) then raise exception 'Toast acquisition function was not activated'; end if;
  if not exists (
    select 1 from momi_runtime.function_trigger_registry
    where trigger_key = 'toast.data.acquisition.http.v1' and active
  ) then raise exception 'Toast acquisition route was not activated'; end if;
  if not exists (
    select 1 from cron.job
    where jobname = 'momi-toast-acquisition-wakeup-v1' and active
  ) then raise exception 'Toast acquisition retry wakeup was not activated'; end if;
  if not exists (
    select 1 from toast_acquisition.jobs
    where operation_key = 'toast.ordering_schedule.snapshot.v1'
      and idempotency_key like 'bootstrap:%'
  ) then raise exception 'Ordering schedule bootstrap job was not created'; end if;
end;
$$;
