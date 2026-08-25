-- service-owner: toast-order-read-api

update momi_runtime.function_registry
set owner_service = 'toast-order-read-api'
where function_key = 'momi.toast_orders.get_by_id.v1';

update momi_api.read_view_registry
set owner_service = 'toast-order-read-api'
where view_key = 'momi.toast_orders.get_by_id.v1';

do $$
begin
  if not exists (
    select 1 from momi_runtime.function_registry
    where function_key = 'momi.toast_orders.get_by_id.v1'
      and owner_service = 'toast-order-read-api'
  ) or not exists (
    select 1 from momi_api.read_view_registry
    where view_key = 'momi.toast_orders.get_by_id.v1'
      and owner_service = 'toast-order-read-api'
  ) then
    raise exception 'Toast order read registrations are missing';
  end if;
end;
$$;
