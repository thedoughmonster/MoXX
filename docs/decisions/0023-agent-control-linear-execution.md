# 0023: Linear-driven Codex agent control

- Status: accepted
- Date: 2026-08-14
- Owning issues: #504 / MOX-151; #517 / MOX-152

## Context

Linear needs one-shot action labels that create visible Codex tasks
without making a webhook, database trigger, or Edge Function a long-running
executor. Provider retries must not duplicate the task, and the private control
ledger must not become a client-facing data contract.

## Decision

Create `agent-control` as the owner of the private `momi_agent_ops` operational
dataset, and `agent-control-host` as the independently deployable destination
adapter for the external Codex-host boundary. A Linear-specific ingress Edge
Function verifies HMAC-SHA256 against
the untouched request bytes, records the complete envelope, and normalizes only
fields named by `updatedFrom`. Exactly one newly added declared action creates
canonical dispatch and run records in the same transaction.

The accepted catalog is `execute-run`, `validate-issue`, `investigate-issue`,
`cleanup`, `decompose`, and `run-discovery`. Events that add more than one
catalog action are ambiguous and do not create work. Each accepted action is
stored on the dispatch, consumed after host acceptance, and reported in the
marker-bound Linear comment. Provider retries converge on the delivery receipt.

Project routing is configuration owned by `momi_agent_ops.project_mappings`.
The first mapping is the Linear Backend Stabilization project to
`thedoughmonster/momi-backend` at `dev`; unknown projects fail closed.

After commit, a dedicated ADR-0004 trigger adapter sends only the dispatch ID
and a per-work capability token to the exact dispatch Edge Function. The
function atomically claims work, then calls the versioned
`momi.agent_control.host_dispatch.v1` contract on the mapped, authenticated
private HTTPS Codex host adapter. This is the exact internal HTTP exception
accepted by this ADR; it authorizes no general service-to-service calls. The adapter durably
reserves the dispatch before issuing Codex
App Server `thread/start` and `turn/start`, so an ambiguous retry cannot create
a second task. It archives the thread after terminal `turn/completed` and sends
an authenticated terminal callback for durable and Linear write-back.

The initial Codex turn contains only the accepted action, stable issue and
mapping identities, plus a bounded action-specific instruction. `execute-run`
owns repository implementation; the other actions are limited to validation,
investigation, metadata cleanup, decomposition, or discovery. Symphony is not
in this boundary. MOX-153 parent/cancellation behavior remains a separate
decision.

## Security and authority

- `momi_agent_ops` is absent from the Supabase Data API schema list; RLS and
  explicit revokes provide defense in depth.
- Edge Functions access the private schema only through `SUPABASE_DB_URL` and
  explicitly granted routines.
- Linear and Codex-host secrets remain runtime secrets and never enter payload
  logs, prompts, database records, or trigger bodies.
- The non-secret host URL is HTTPS-only private project configuration, resolved
  at claim time so endpoint rotation does not require an Edge Function secret
  change. The bearer credential remains a runtime secret. The service declares
  `api.linear.app` and that configured boundary as outbound authority.
- Trigger networking is restricted to the exact dispatch route and the standard
  project URL/publishable-key Vault records accepted by ADR 0004.

## Failure and rollback

Each boundary is idempotent. Claims use short leases; retries rotate the
capability token, and ambiguous host creation remains quarantined rather than
repeated. Linear labels/comments are reconciled from durable state. A failed
ingress transaction cannot enqueue network work.

Rollback removes the functions and trigger only through the normal manifest
retirement and additive-migration process. Existing ledger history is retained;
no rollback repeats an ambiguous task creation.
