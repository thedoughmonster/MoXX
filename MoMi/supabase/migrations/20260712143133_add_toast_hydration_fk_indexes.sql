create index function_trigger_registry_function_key_idx
  on toast_hydration.function_trigger_registry (function_key);

create index order_hydration_jobs_function_key_idx
  on toast_hydration.order_hydration_jobs (function_key);
