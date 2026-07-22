-- service-owner: warehouse-read-api

create or replace function momi_analysis.execute_query_v1(p_sql text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, momi_analysis
as $$
declare
  result jsonb;
begin
  if current_user <> 'svc_communications_gateway'
    or current_setting('transaction_read_only') <> 'on'
    or p_sql is null or length(p_sql) > 6000
    or p_sql !~* '^\s*(select|with)\M'
    or p_sql ~ '(;|--|/\*)'
    or p_sql ~* '\m(insert|update|delete|merge|copy|call|do|set|reset|create|alter|drop|truncate|vacuum|analyze|explain)\M'
  then
    raise exception 'analysis_query_rejected';
  end if;
  execute format(
    'select jsonb_build_object(''rows'', coalesce(jsonb_agg(row_data order by ordinal) filter (where ordinal <= 100), ''[]''::jsonb), ''row_count'', least(count(*)::integer, 100), ''truncated'', count(*) > 100) from (select row_number() over () as ordinal, to_jsonb(query_row) as row_data from (%s) as query_row limit 101) as bounded',
    p_sql
  ) into result;
  if octet_length(result::text) > 65536 then
    raise exception 'analysis_result_too_large';
  end if;
  return result;
end;
$$;

comment on function momi_analysis.execute_query_v1(text) is
  'Executes one gateway-parsed SELECT or safe CTE under the declared read-only role.';
