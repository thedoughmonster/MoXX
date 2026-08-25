drop index
  momi_runtime.function_trigger_registry_one_active_http_per_function_idx;

create unique index function_trigger_registry_one_active_route_per_function_idx
  on momi_runtime.function_trigger_registry (function_key)
  where active and trigger_type in ('http', 'durable_http');
