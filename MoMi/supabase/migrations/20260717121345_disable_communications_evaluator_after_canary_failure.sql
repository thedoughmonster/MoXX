-- service-owner: communications-archive

update momi_runtime.function_trigger_registry
set active = false
where trigger_key = 'momi.communications.evaluate_item.http.v1'
  and function_key = 'momi.communications.evaluate_item.v1'
  and owner_service = 'communications-archive';

update momi_runtime.function_registry
set active = false
where function_key = 'momi.communications.evaluate_item.v1'
  and owner_service = 'communications-archive';

select cron.alter_job(job_id := jobid, active := false)
from cron.job
where jobname = 'momi-communications-evaluator-wakeup-v1';

do $$
begin
  if exists (select 1 from momi_runtime.function_trigger_registry
    where trigger_key = 'momi.communications.evaluate_item.http.v1' and active)
  then raise exception 'Communications evaluator route remained active'; end if;

  if exists (select 1 from momi_runtime.function_registry
    where function_key = 'momi.communications.evaluate_item.v1' and active)
  then raise exception 'Communications evaluator function remained active'; end if;

  if (select count(*) from cron.job
    where jobname = 'momi-communications-evaluator-wakeup-v1'
      and not active and schedule = '30 seconds') <> 1
  then raise exception 'Communications evaluator schedule is not disabled'; end if;
end;
$$;
