-- service-owner: communications-evaluation

create role svc_communications_evaluation
  nologin noinherit nosuperuser nocreatedb nocreaterole
  noreplication nobypassrls;

comment on role svc_communications_evaluation is
  'Non-login capability role for communications-evaluation database contracts.';
