# Edge Function Manifest v1

Every owned function has one complete `function.json` beside its service code:
`services/<service-key>/functions/<slug>/function.json`. The matching
`supabase/functions/<slug>/` directory contains only its deployment adapter.

## Logical Identity

These fields explain what the function is and who owns it:

- `function_key`: stable, versioned contract identifier.
- `contract_version`: positive integer contract version.
- `purpose`: one plain-language sentence describing the owned operation.
- `owner_service`: stable owning module identifier.
- `function_type`: registry-compatible implementation category.
- `capability`: one of `ingest`, `hydrate`, `read`, `decide`, or `deliver`.
- `boundary`: one of `toast_inbound`, `toast_outbound`, `trello_inbound`,
  `trello_outbound`, `linear_inbound`, `openai_inbound`, `momi_internal`, `momi_public`, or
  `slack_outbound`.

Logical identity is authoritative. A function's directory or runtime does not
define its business purpose.

## Deployment Metadata

- `runtime` must be `supabase_edge` while deployed as an Edge Function.
- `route_path` must be `/functions/v1/<function-directory>`.
- `authentication_policy_key` names the authentication contract.
- `entrypoint` names the matching adapter entrypoint.
- `input_schema` and `output_schema` are function-relative contract paths.
- `probe`, when present, declares the safe HTTP method and exact acceptable
  statuses for deployment reachability checks. Use it when a bare `GET` is not
  a valid request for the function contract.

## Authority Declaration

- `required_capabilities` lists the resources the function must access.
- `declared_side_effects` lists every durable or external effect it can cause.
- Optional `capability_model` opts a function into
  [Function Capability Model v1](./function-capability-model-v1.md). Its
  `called_contracts` are exact direct contract calls and must be a sorted,
  unique subset of the owning service's consumed contracts.
- Policy keys for timeout, retry, and idempotency are included when applicable.

For an opted-in function, only `database_read` and `database_write` are valid
direct non-contract capability values. A called contract is a separate direct
namespace. Provider effects derived behind that contract and
`declared_side_effects` are analysis-only and never grant authority. Missing
`capability_model` remains schema-compatible during staged adoption but cannot
support a completeness or positive-grant claim.

Arrays may be empty but may not be omitted. Fields not declared by the v1 schema
are invalid at every closed object boundary. Add a field only through a reviewed
change that updates the schema, this contract, and focused regression coverage;
do not rely on unknown fields for forward compatibility.

## Generated Catalog

Run `npm run catalog:generate` after changing a manifest. The committed
`docs/service-catalog.md` is generated from manifests and must not be edited by
hand. `npm run check -- --service <key|all>` validates ownership, contracts,
the adapter, and catalog drift.
