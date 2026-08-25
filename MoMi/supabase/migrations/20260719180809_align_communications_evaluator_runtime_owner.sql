-- service-owner: runtime-registry

do $owner_alignment$
declare
  function_was_active boolean;
  trigger_was_active boolean;
  affected integer;
begin
  if (select count(*) from momi_runtime.function_registry
    where function_key = 'momi.communications.evaluate_item.v1'
      and contract_version = 1
      and function_type = 'coordinator'
      and owner_service = 'communications-archive'
      and manifest_sha256 =
        '5ab32381c03d31d5cdab9889986340c956486bada99ae199b2dbda420562db05'
  ) <> 1 then
    raise exception 'Communications evaluator function registration drifted';
  end if;

  select active into strict function_was_active
  from momi_runtime.function_registry
  where function_key = 'momi.communications.evaluate_item.v1'
    and contract_version = 1
    and function_type = 'coordinator'
    and owner_service = 'communications-archive'
    and manifest_sha256 =
      '5ab32381c03d31d5cdab9889986340c956486bada99ae199b2dbda420562db05';

  if (select count(*) from momi_runtime.function_trigger_registry
    where trigger_key = 'momi.communications.evaluate_item.http.v1'
      and function_key = 'momi.communications.evaluate_item.v1'
      and contract_version = 1
      and trigger_type = 'http'
      and http_method = 'POST'
      and route_path = '/functions/v1/momi-communications-evaluate-item-v1'
      and schedule_policy_key = 'momi.communications.evaluator.schedule.v1'
      and authentication_policy_key = 'durable.work_token.v1'
      and owner_service = 'communications-archive'
  ) <> 1 then
    raise exception 'Communications evaluator trigger registration drifted';
  end if;

  select active into strict trigger_was_active
  from momi_runtime.function_trigger_registry
  where trigger_key = 'momi.communications.evaluate_item.http.v1'
    and function_key = 'momi.communications.evaluate_item.v1'
    and contract_version = 1
    and trigger_type = 'http'
    and http_method = 'POST'
    and route_path = '/functions/v1/momi-communications-evaluate-item-v1'
    and schedule_policy_key = 'momi.communications.evaluator.schedule.v1'
    and authentication_policy_key = 'durable.work_token.v1'
    and owner_service = 'communications-archive';

  update momi_runtime.function_registry
  set owner_service = 'communications-evaluation',
      manifest_sha256 =
        'dda1dd7becf240cdb55ddcb242afb72148f9be8e785f1b5b8bc0e6005066e65c'
  where function_key = 'momi.communications.evaluate_item.v1'
    and contract_version = 1
    and function_type = 'coordinator'
    and owner_service = 'communications-archive'
    and manifest_sha256 =
      '5ab32381c03d31d5cdab9889986340c956486bada99ae199b2dbda420562db05';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Communications evaluator function alignment changed % rows', affected;
  end if;

  update momi_runtime.function_trigger_registry
  set owner_service = 'communications-evaluation'
  where trigger_key = 'momi.communications.evaluate_item.http.v1'
    and function_key = 'momi.communications.evaluate_item.v1'
    and contract_version = 1
    and trigger_type = 'http'
    and http_method = 'POST'
    and route_path = '/functions/v1/momi-communications-evaluate-item-v1'
    and schedule_policy_key = 'momi.communications.evaluator.schedule.v1'
    and authentication_policy_key = 'durable.work_token.v1'
    and owner_service = 'communications-archive';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Communications evaluator trigger alignment changed % rows', affected;
  end if;

  if (select count(*) from momi_runtime.function_registry
    where function_key = 'momi.communications.evaluate_item.v1'
      and contract_version = 1
      and function_type = 'coordinator'
      and owner_service = 'communications-evaluation'
      and manifest_sha256 =
        'dda1dd7becf240cdb55ddcb242afb72148f9be8e785f1b5b8bc0e6005066e65c'
      and active is not distinct from function_was_active
  ) <> 1 then
    raise exception 'Communications evaluator function alignment failed';
  end if;

  if (select count(*) from momi_runtime.function_trigger_registry
    where trigger_key = 'momi.communications.evaluate_item.http.v1'
      and function_key = 'momi.communications.evaluate_item.v1'
      and contract_version = 1
      and trigger_type = 'http'
      and http_method = 'POST'
      and route_path = '/functions/v1/momi-communications-evaluate-item-v1'
      and schedule_policy_key = 'momi.communications.evaluator.schedule.v1'
      and authentication_policy_key = 'durable.work_token.v1'
      and owner_service = 'communications-evaluation'
      and active is not distinct from trigger_was_active
  ) <> 1 then
    raise exception 'Communications evaluator trigger alignment failed';
  end if;
end;
$owner_alignment$;
