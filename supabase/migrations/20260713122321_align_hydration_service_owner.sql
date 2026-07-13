-- service-owner: toast-order-hydration

update momi_runtime.function_registry
set owner_service = 'toast-order-hydration'
where function_key = 'toast.orders.fetch_by_guid.v1';

do $$
begin
  if not exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'toast.orders.fetch_by_guid.v1'
      and owner_service = 'toast-order-hydration'
  ) then
    raise exception 'Toast hydration function registration is missing';
  end if;
end;
$$;
