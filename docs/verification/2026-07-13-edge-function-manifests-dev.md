# Edge Function Manifest Dev Verification

- Date: 2026-07-13
- Environment: persistent Supabase `dev` branch
- Result: passed
- Production changed: no

## Policy

The root agent contract now requires a complete manifest for every Edge
Function. `supabase/functions/AGENTS.md` defines the local enforcement rule and
points to `docs/contracts/edge-function-manifest-v1.md` for the exact contract.

Logical purpose, capability, boundary, and ownership are authoritative.
Directory, route, and runtime remain deployment metadata.

## Catalog

All five active functions have complete manifests and appear in the generated
`docs/service-catalog.md` lifecycle:

- ingest: `toast.orders.webhook_ingest.v1`
- hydrate: `toast.orders.fetch_by_guid.v1`
- read: `momi.orders.get_by_guid.v1`
- decide: `toast.orders.alert_from_hydrated_order.v1`
- deliver: `toast.slack_order_alert.deliver.v1`

The webhook now owns explicit input and output JSON Schemas. Its input schema
allows additional Toast fields so source data remains complete.

Each function directory also owns a concise README and function-specific agent
contract. Parent agent files retain shared engineering rules; local agent files
contain only the authority and safety invariants unique to that function. The
manifest regression test requires both files for every active function.

## Dev Registry

The four functions owned by `toast_hydration.function_registry` were updated to
the SHA-256 hashes of their complete manifests and verified by readback. The
inbound webhook is intentionally outside that hydration registry.

## Verification

- Node: `24.14.0`
- Tests: `19` passed, `0` failed
- Manifest/catalog regression test: passed
- Active function manifests: `5`
- Handwritten changed files: all at or below `120` lines
- Diff whitespace check: passed
