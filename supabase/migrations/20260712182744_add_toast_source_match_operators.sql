alter table toast_alerting.toast_sources
  add column match_operator text not null default 'equals';

alter table toast_alerting.toast_sources
  add constraint toast_sources_match_operator_valid
  check (match_operator in ('equals', 'not_equals'));

comment on column toast_alerting.toast_sources.match_operator is
  'Configured comparison for the source payload path and expected value.';

create function toast_alerting.matches_source_value(
  input_payload jsonb,
  input_path text[],
  input_expected_value jsonb,
  input_match_operator text
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case input_match_operator
    when 'equals' then
      input_payload #> input_path = input_expected_value
    when 'not_equals' then
      input_payload #>> input_path is not null
      and input_payload #> input_path <> input_expected_value
    else false
  end;
$$;

comment on function toast_alerting.matches_source_value(jsonb, text[], jsonb, text)
  is 'Evaluates one configured source value without matching missing values.';

revoke all on function
  toast_alerting.matches_source_value(jsonb, text[], jsonb, text)
  from public, anon, authenticated;
