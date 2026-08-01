-- service-owner: communications-archive

insert into momi_communications.source_types (
  source_type,
  capture_contract_key,
  description,
  active
) values (
  'square_payment_webhook',
  'momi.raw_json.capture_evidence.v1',
  'Complete authenticated Square payment webhook evidence.',
  true
)
on conflict (source_type) do update
set description = excluded.description,
  active = true
where momi_communications.source_types.capture_contract_key =
  excluded.capture_contract_key;

do $$
begin
  if not exists (
    select 1
    from momi_communications.source_types
    where source_type = 'square_payment_webhook'
      and capture_contract_key = 'momi.raw_json.capture_evidence.v1'
      and active
  ) then
    raise exception 'Square payment webhook archive registration conflicts'
      using errcode = '23505';
  end if;
end;
$$;

create unique index archive_items_square_payment_webhook_replay_unique
on momi_communications.archive_items (
  source_type,
  source_account_key,
  idempotency_key
)
where source_type = 'square_payment_webhook';
