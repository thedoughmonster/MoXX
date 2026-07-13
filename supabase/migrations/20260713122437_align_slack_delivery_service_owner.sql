-- service-owner: slack-order-delivery

update momi_runtime.function_registry
set owner_service = 'slack-order-delivery'
where function_key = 'momi.slack.order_alert.deliver.v1';

do $$
begin
  if not exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'momi.slack.order_alert.deliver.v1'
      and owner_service = 'slack-order-delivery'
  ) then
    raise exception 'Slack delivery function registration is missing';
  end if;
end;
$$;
