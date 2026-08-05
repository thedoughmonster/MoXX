-- service-owner: cron-history-governance

create function momi_cron_history.derive_provider_warning_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_swap_used_bytes numeric;
  swap_increased boolean := false;
begin
  select sample.swap_used_bytes
  into previous_swap_used_bytes
  from momi_cron_history.health_samples sample
  where sample.sample_id <> new.sample_id
    and sample.source_complete
    and sample.swap_used_bytes is not null
  order by sample.source_observed_at desc
  limit 1;

  if found then
    swap_increased := new.swap_used_bytes is not null
      and new.swap_used_bytes > previous_swap_used_bytes;
  else
    swap_increased := coalesce(new.swap_used_bytes > 0, false);
  end if;

  new.provider_warning :=
    coalesce(new.cpu_pct >= 70, false)
    or coalesce(new.ram_pct >= 80, false)
    or swap_increased
    or coalesce(new.io_pct >= 60, false)
    or coalesce(new.allocated_disk_pct >= 80, false);
  return new;
end;
$$;

revoke all on function momi_cron_history.derive_provider_warning_v1()
from public;

create trigger derive_provider_warning_v1
before insert or update of
  cpu_pct,
  ram_pct,
  swap_used_bytes,
  io_pct,
  allocated_disk_pct,
  provider_warning
on momi_cron_history.health_samples
for each row execute function momi_cron_history.derive_provider_warning_v1();
