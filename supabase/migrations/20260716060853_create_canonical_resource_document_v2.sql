-- service-owner: warehouse-projection

create function warehouse_projection.canonical_resource_document_v2(
  p_entity_id uuid,
  p_entity_type text,
  p_location_id uuid,
  p_resource_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  document jsonb;
begin
  if p_entity_type in (
    'menu', 'menu_group', 'menu_item',
    'modifier_group', 'modifier_option'
  ) then
    document := warehouse_projection.canonical_menu_document(
      p_entity_id, p_entity_type, p_location_id, p_payload, '{}'::jsonb
    );
    return document || jsonb_strip_nulls(jsonb_build_object(
      'active', coalesce(case p_payload ->> 'deleted'
        when 'true' then 'false'::jsonb
        when 'false' then 'true'::jsonb end, document -> 'active'),
      'online_orderable', p_payload -> 'orderableOnline'
    ));
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'id', p_entity_id,
    'entity_type', p_entity_type,
    'location_id', p_location_id,
    'name', coalesce(p_payload ->> 'name', p_payload ->> 'displayName',
      p_payload ->> 'title'),
    'description', p_payload ->> 'description',
    'status', coalesce(p_payload ->> 'status',
      p_payload ->> 'paymentStatus'),
    'active', coalesce(p_payload -> 'active', case p_payload ->> 'deleted'
      when 'true' then 'false'::jsonb
      when 'false' then 'true'::jsonb end),
    'archived', coalesce(p_payload -> 'archived', p_payload -> 'deleted'),
    'amount', p_payload -> 'amount',
    'tip_amount', p_payload -> 'tipAmount',
    'paid_at', p_payload ->> 'paidDate',
    'refunded_at', p_payload ->> 'refundDate',
    'voided', p_payload -> 'voided',
    'payment_type', p_payload ->> 'type',
    'card_type', p_payload ->> 'cardType',
    'first_name', p_payload ->> 'firstName',
    'last_name', p_payload ->> 'lastName',
    'email', p_payload ->> 'email',
    'phone', p_payload ->> 'phoneNumber',
    'starts_at', coalesce(p_payload ->> 'startDate', p_payload ->> 'inDate'),
    'ends_at', coalesce(p_payload ->> 'endDate', p_payload ->> 'outDate'),
    'business_date', p_payload ->> 'businessDate',
    'regular_hours', p_payload -> 'regularHours',
    'overtime_hours', p_payload -> 'overtimeHours',
    'hourly_wage', p_payload -> 'hourlyWage',
    'auto_clocked_out', p_payload -> 'autoClockedOut',
    'code', p_payload ->> 'code',
    'tipped', p_payload -> 'tipped',
    'default_wage', p_payload -> 'defaultWage',
    'wage_frequency', p_payload ->> 'wageFrequency',
    'excluded_from_reporting', p_payload -> 'excludeFromReporting',
    'behavior', p_payload ->> 'behavior',
    'curbside', p_payload -> 'curbside'
  ));
end;
$$;

comment on function warehouse_projection.canonical_resource_document_v2(
  uuid, text, uuid, text, jsonb
) is 'Builds source-neutral canonical resource documents without source DTOs.';

revoke all on function warehouse_projection.canonical_resource_document_v2(
  uuid, text, uuid, text, jsonb
) from public, anon, authenticated;
