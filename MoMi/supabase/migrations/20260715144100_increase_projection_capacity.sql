-- service-owner: warehouse-projection

update warehouse_projection.worker_settings
set max_parallel_deliveries = 6,
    updated_at = now()
where subscription_key = 'warehouse-projection-toast-v1';

do $$
begin
  if (select max_parallel_deliveries
      from warehouse_projection.worker_settings
      where subscription_key = 'warehouse-projection-toast-v1') is distinct from 6
  then
    raise exception 'Projection parallelism was not raised to six';
  end if;
end;
$$;
