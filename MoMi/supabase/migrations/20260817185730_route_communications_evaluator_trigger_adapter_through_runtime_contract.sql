-- service-owner: communications-evaluation

create or replace function momi_communications.wake_communications_evaluator()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  route_path text;
  project_url text;
  gateway_key text;
begin
  if new.job_status not in ('pending', 'failed')
    or new.next_attempt_at > now()
  then return new;
  end if;

  select resolved.route_path into route_path
  from momi_runtime.resolve_communications_evaluation_trigger_v1() as resolved;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'momi_project_url';
  select decrypted_secret into gateway_key
  from vault.decrypted_secrets where name = 'momi_publishable_key';
  if route_path is null or project_url is null or gateway_key is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'evaluation_job_id', new.evaluation_job_id::text,
      'capability_token', new.capability_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;
