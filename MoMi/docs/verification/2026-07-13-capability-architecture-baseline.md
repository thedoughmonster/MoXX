# Capability Architecture Baseline

- Captured: 2026-07-13
- Source commit: `613f0306ade40f2a51d57d6434ab69d4f0ab4b8a`
- Source branches: `dev` and `prod`
- Runtime: Node.js `24.14.0`
- Supabase CLI observed locally: `2.72.7`

## Local Verification

The complete repository test command passed before architecture changes:

- tests: 33
- passed: 33
- failed: 0
- handwritten files above 120 lines: 0

All five Edge Function entrypoints were wiring-only files that registered a
local `handleRequest` implementation.

## Migration State

Production and development each reported the same 43 applied migrations. The
latest migration in both environments was:

`20260713080437_fix_slack_order_alert_summary_newlines`

## Hosted Function Inventory

Declared functions active in both environments:

- `toast-orders-webhook-ingest-v1`
- `toast-orders-fetch-by-guid-v1`
- `momi-toast-orders-get-by-id-v1`
- `momi-order-alert-worker-v1`
- `slack-order-alert-delivery-v1`

Undeclared hosted functions:

- production: `toast-orders-probe`
- development: `momi-orders-get-by-guid-v1`
- development: `toast-order-alert-worker-v1`

These functions require an explicit retirement decision before inventory can
become a blocking deployment gate.

## Durable Flow State

Development contained two complete Toast order versions, four successful API
work items, three alert candidates, and three successful Slack delivery work
items. Production contained 356 webhook events, 31 complete order versions, 31
successful API work items, seven alert candidates, and seven successful Slack
delivery work items.

Both environments had four active internal function registrations and four
active trigger registrations. No source payloads, tokens, channel identifiers,
or other credentials were captured in this baseline.
