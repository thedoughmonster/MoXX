-- service-owner: warehouse-read-api

grant svc_communications_gateway to postgres
  with inherit false, set true;
set role svc_communications_gateway;

grant execute on function momi_analysis.execute_query_v1(text) to postgres;
comment on function momi_analysis.execute_query_v1(text) is
  'Executes one gateway-parsed SELECT or safe CTE as the non-login curated analysis role.';

reset role;
grant svc_communications_gateway to postgres
  with inherit false, set false;
