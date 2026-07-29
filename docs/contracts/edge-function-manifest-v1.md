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
  `trello_outbound`, `openai_inbound`, `momi_internal`, or `slack_outbound`.

Logical identity is authoritative. A function's directory or runtime does not
define its business purpose.

## Deployment Metadata

- `runtime` must be `supabase_edge` while deployed as an Edge Function.
- `route_path` must be `/functions/v1/<function-directory>`.
- `authentication_policy_key` names the authentication contract.
- `entrypoint` names the matching adapter entrypoint.
- `input_schema` and `output_schema` are function-relative contract paths.

## Authority Declaration

- `required_capabilities` lists the resources the function must access.
- `declared_side_effects` lists every durable or external effect it can cause.
- Policy keys for timeout, retry, and idempotency are included when applicable.

Arrays may be empty but may not be omitted. Unknown fields are allowed so later
versions can add policy references without weakening this baseline.

## Generated Catalog

Run `npm run catalog:generate` after changing a manifest. The committed
`docs/service-catalog.md` is generated from manifests and must not be edited by
hand. `npm run check -- --service <key|all>` validates ownership, contracts,
the adapter, and catalog drift.
