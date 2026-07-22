-- service-owner: warehouse-read-api

grant svc_communications_gateway to postgres
  with inherit false, set true;
grant create on schema momi_analysis to svc_communications_gateway;

alter function momi_analysis.execute_query_v1(text) security definer;
revoke all on function momi_analysis.execute_query_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function momi_analysis.execute_query_v1(text)
  to svc_communications_gateway;
comment on function momi_analysis.execute_query_v1(text) is
  'Executes one gateway-parsed SELECT or safe CTE as the non-login curated analysis role.';

alter function momi_analysis.execute_query_v1(text)
  owner to svc_communications_gateway;

revoke create on schema momi_analysis from svc_communications_gateway;
grant svc_communications_gateway to postgres
  with inherit false, set false;
