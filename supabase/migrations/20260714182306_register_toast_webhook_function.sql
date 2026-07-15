-- service-owner: toast-webhook-ingestion

insert into momi_runtime.function_registry (
  function_key, contract_version, function_type, active,
  owner_service, manifest_sha256
) values (
  'toast.webhooks.webhook_ingest.v1', 1, 'action', true,
  'toast-webhook-ingestion',
  'cff34263961676b29e96f7638993b6db9ef41d11827c9b9c812f607d100549ed'
);

insert into momi_runtime.function_parameter_map (
  function_key, parameter_key, source_parameter_name,
  parameter_location, required, data_type, pass_to_source,
  store_in_run_log, display_order
) values
  ('toast.webhooks.webhook_ingest.v1', 'raw_body', 'raw_body',
    'body', true, 'json', false, false, 1),
  ('toast.webhooks.webhook_ingest.v1', 'toast_signature', 'toast-signature',
    'header', true, 'string', false, false, 2);

insert into momi_runtime.function_trigger_registry (
  trigger_key, function_key, contract_version, trigger_type,
  http_method, route_path, authentication_policy_key,
  active, owner_service
) values (
  'toast.webhooks.webhook_ingest.http.v1',
  'toast.webhooks.webhook_ingest.v1', 1, 'http', 'POST',
  '/functions/v1/toast-webhooks-ingest-v1',
  'toast.webhooks.subscription_signature.v1', true,
  'toast-webhook-ingestion'
);
