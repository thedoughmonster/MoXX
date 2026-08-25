# Source-Neutral Order Alert Dev Verification

- Date: 2026-07-13
- Environment: persistent Supabase `dev` project
- Result: passed
- Production changed: no

## Function Split

The Toast-owned warehouse reader is now
`momi.toast_orders.get_by_id.v1` at
`/functions/v1/momi-toast-orders-get-by-id-v1`.

The decision worker is now source-neutral:
`momi.orders.alert.evaluate.v1` at
`/functions/v1/momi-order-alert-worker-v1`. It resolves exactly one active
owned reader route from durable work and `momi_runtime` configuration.

Slack delivery remains destination-specific and is source-neutral under
`momi.slack.order_alert.deliver.v1`.

## Database Cutover

Nine applied migrations moved shared state without recreating rows:

- Function and trigger registries moved to `momi_runtime`.
- Owned API work and attempts moved to `momi_orders`.
- Alert configuration, candidates, and Slack work moved to `momi_alerting`.
- Toast raw records and hydration work remained Toast-owned.
- Existing source-specific candidate provenance moved into `decision_context`.
- API and alert identity now use generic source, order, and version fields.
- Active HTTP and durable-HTTP routes are unique per function contract.

Migration SQL first passed as one rollback-only transaction. Baseline and
post-cutover row counts matched for API work, attempts, candidates, Slack work,
source mappings, rules, routes, and destinations.

## Controlled Order

The preserved pending API work had an exact warehouse view row. Its first wake
returned `409` without claiming work because the worker expected trigger type
`http` while the established contract is `durable_http`.

A new correction migration and worker version fixed that contract. Reusing the
same durable work then produced:

- Owned reader response: `200`
- Alert worker response: `200`
- Source match: `toast_out_of_store`
- Candidate count: `1`
- Slack delivery response: `200`
- Slack message identity recorded: yes

Replaying the succeeded work returned `replay: true`. API attempts, candidates,
and Slack attempts each remained at one for that work.

## Configuration

`toast_in_store` and `toast_out_of_store` are independently enabled. Each has
its own enabled rule, route, enabled Slack destination, and configured channel.
No business values or channel ids were added to migrations or function code.

## Final State

- Toast hydration jobs: `3 succeeded`
- Owned API work: `2 succeeded`
- Slack delivery work: `2 succeeded`
- Node: `24.14.0`
- Tests: `30 passed`, `0 failed`
- Changed handwritten files: all at or below `120` lines
- Security advisors: informational private-table RLS notices only
- Performance advisors: informational unused-index notices only
- Production function inventory: unchanged

## Residual Cleanup

- The retired dev deployments `momi-orders-get-by-guid-v1` and
  `toast-order-alert-worker-v1` remain hosted but are absent from source,
  config, and active runtime routes. Dashboard deletion requires explicit
  approval.
- `MOMI_CODE_COMMIT_SHA` still contains its pre-cutover value. Deployment ids
  identify the versions verified above; update the secret before relying on a
  new attempt row for commit-level provenance.
