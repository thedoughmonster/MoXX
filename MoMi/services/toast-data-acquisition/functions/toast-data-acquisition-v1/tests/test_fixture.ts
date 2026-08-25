import type { ClaimedJob, RegisteredOperation } from "../src/registry_types.ts";

export function makeFixture(): {
  job: ClaimedJob;
  operation: RegisteredOperation;
} {
  return {
    job: {
      job_id: "42",
      operation_key: "toast.orders.bulk.v1",
      source_key: "toast",
      restaurant_guid: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      mode: "backfill",
      window_start: "2026-07-01T00:00:00.000Z",
      window_end: "2026-07-03T00:00:00.000Z",
      cursor: {},
      parameters: {},
      correlation_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      capability_token: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    },
    operation: {
      operation_key: "toast.orders.bulk.v1",
      source_operation_id: "ordersBulkGet",
      http_method: "GET",
      path_template: "/orders/v2/ordersBulk",
      resource_type: "order",
      response_kind: "collection",
      pagination_kind: "page",
      page_size: 100,
      requires_window: true,
      exact_resource_only: false,
      schema_version: 1,
      api_base_url: "https://toast.example",
      client_id_secret_name: "TOAST_CLIENT_ID",
      client_secret_secret_name: "TOAST_CLIENT_SECRET",
      user_access_type: "TOAST_MACHINE_CLIENT",
      request_timeout_ms: 5000,
      first_business_date: "2024-06-21",
      operation_parameters: [
        {
          parameter_key: "startDate",
          parameter_location: "query",
          data_type: "timestamp",
          required: false,
          validation_pattern: null,
        },
        {
          parameter_key: "endDate",
          parameter_location: "query",
          data_type: "timestamp",
          required: false,
          validation_pattern: null,
        },
        {
          parameter_key: "page",
          parameter_location: "query",
          data_type: "integer",
          required: false,
          validation_pattern: "^[1-9][0-9]*$",
        },
        {
          parameter_key: "pageSize",
          parameter_location: "query",
          data_type: "integer",
          required: false,
          validation_pattern: "^(100|[1-9][0-9]?)$",
        },
      ],
    },
  };
}
