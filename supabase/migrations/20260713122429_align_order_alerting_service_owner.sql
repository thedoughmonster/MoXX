-- service-owner: order-alerting

update momi_runtime.function_registry
set owner_service = 'order-alerting'
where function_key = 'momi.orders.alert.evaluate.v1';

do $$
begin
  if not exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'momi.orders.alert.evaluate.v1'
      and owner_service = 'order-alerting'
  ) then
    raise exception 'Order alerting function registration is missing';
  end if;
end;
$$;
