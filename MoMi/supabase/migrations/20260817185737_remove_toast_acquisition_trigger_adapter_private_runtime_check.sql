-- service-owner: toast-data-acquisition

create or replace function toast_acquisition.wake_acquisition_worker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_path constant text := '/functions/v1/toast-data-acquisition-v1';
  project_url text;
  gateway_key text;
begin
  if new.next_attempt_at > now() then return new; end if;

  select decrypted_secret into project_url from vault.decrypted_secrets
  where name = 'momi_project_url';
  select decrypted_secret into gateway_key from vault.decrypted_secrets
  where name = 'momi_publishable_key';
  if project_url is null or gateway_key is null then
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || route_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json', 'apikey', gateway_key
    ),
    body := jsonb_build_object(
      'job_id', new.job_id::text,
      'capability_token', new.capability_token::text
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;
