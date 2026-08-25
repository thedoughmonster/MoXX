-- service-owner: toast-data-acquisition
do $$
begin
  if not exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'toast.data.acquisition.v1'
      and owner_service = 'toast-data-acquisition' and active
  ) or not exists (
    select 1 from momi_runtime.function_trigger_registry
    where trigger_key = 'toast.data.acquisition.http.v1'
      and function_key = 'toast.data.acquisition.v1' and active
  ) then raise exception 'Toast acquisition worker is not active';
  end if;

  with eligible as materialized (
    select schedule.*,
      now() at time zone schedule.timezone as local_now
    from toast_acquisition.schedules as schedule
    join toast_acquisition.operations as operation using (operation_key)
    join toast_acquisition.restaurants as restaurant
      on restaurant.source_key = schedule.source_key
      and restaurant.restaurant_guid = schedule.restaurant_guid
    where operation.is_enabled and restaurant.is_enabled
      and not schedule.active
  ), candidates as materialized (
    select eligible.*,
      (local_now::date + local_run_time)
        at time zone timezone as daily_due,
      (date_trunc('month', local_now)::date + (day_of_month - 1)
        + local_run_time) at time zone timezone as monthly_due
    from eligible
  ), planned as (
    select schedule_key, case schedule_kind
      when 'interval' then now()
      when 'daily' then case when daily_due > now() then daily_due
        else (local_now::date + 1 + local_run_time)
          at time zone timezone end
      else case when monthly_due > now() then monthly_due
        else ((date_trunc('month', local_now) + interval '1 month')::date
          + (day_of_month - 1) + local_run_time)
          at time zone timezone end
      end as first_due_at
    from candidates
  )
  update toast_acquisition.schedules as schedule
  set next_due_at = planned.first_due_at, active = true
  from planned where schedule.schedule_key = planned.schedule_key;

  perform cron.alter_job(job_id := jobid, active := true)
  from cron.job where jobname = 'momi-toast-acquisition-due-v1';

  if exists (
    select 1 from toast_acquisition.schedules as schedule
    join toast_acquisition.operations as operation using (operation_key)
    join toast_acquisition.restaurants as restaurant
      on restaurant.source_key = schedule.source_key
      and restaurant.restaurant_guid = schedule.restaurant_guid
    where operation.is_enabled and restaurant.is_enabled
      and not schedule.active
  ) then raise exception 'Eligible acquisition schedules remain inactive';
  end if;
  if exists (
    select 1 from toast_acquisition.schedules
    where active and schedule_kind <> 'interval' and next_due_at <= now()
  ) then raise exception 'Non-interval schedule is immediately overdue';
  end if;
  if (select count(*) from cron.job
    where jobname = 'momi-toast-acquisition-due-v1' and active) <> 1
  then raise exception 'Acquisition due cron is not uniquely active';
  end if;
  if exists (
    select 1 from momi_events.subscriptions
    where subscription_key = 'order-alerting-v1' and active
  ) or exists (
    select 1 from cron.job where active
      and jobname = 'momi-order-alert-event-wakeup-v1'
  ) then raise exception 'Order alert event activation occurred early';
  end if;
end;
$$;
