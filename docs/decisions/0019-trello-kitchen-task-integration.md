# 0019: Trello Kitchen Task Integration

- Status: accepted
- Date: 2026-07-27

## Context

Kitchen staff need a familiar shared task surface now, while MoMi needs durable
assignment and audit history that will survive Trello's eventual replacement.
The existing `Kitchen Operations` board and its cards must be preserved. Trello
Free is the operating constraint, so the integration cannot depend on custom
fields, advanced checklists, or paid automation.

## Decision

MoMi owns kitchen task identity, recurrence, assignment, checklist state,
workflow state, and append-only audit events. Trello is a temporary execution
projection. MoMi UUIDs are canonical; board, list, card, checklist, action,
member, and webhook IDs are stored only as typed external references.

Four services enforce the boundary:

- `trello-data-acquisition` performs allowlisted Trello REST reads and returns
  complete source responses through its source contract. It consumes no
  MoMi-owned contract.
- `trello-evidence-ingestion` authenticates inbound webhooks, coordinates
  reconciliation reads through `trello-data-acquisition`, and submits complete
  JSON evidence through `momi.raw_json.capture_evidence.v1`.
- `kitchen-task-management` owns the source-neutral task dataset and consumes
  immutable Trello evidence references exactly once.
- `trello-task-delivery` accepts prepared mutations, calls only Trello REST
  endpoints, records attempts, and emits reference-only outcome events.

The evidence-ingestion service, not the procurement adapter, calls the archive.
The raw archive emits `archive.raw_json.captured`; event routing transports the
archive reference, not a copied Trello payload. Procurement remains limited to
Trello source access and cannot call any MoMi-owned service.

Inbound POST authentication uses Trello's HMAC over the exact raw request body
concatenated with the exact configured callback URL. `action.id` is the durable
inbound idempotency key. HEAD probes return success without creating evidence.
The public callback uses the existing Supabase Edge Function host and performs
its own provider authentication because provider calls carry no MoMi JWT.

Outbound requests include a non-secret `X-Trello-Client-Identifier` containing
the durable delivery operation ID. The marker is correlation metadata, never
authentication. MoMi-originated webhook actions remain archived and audited,
but a matching operation does not enqueue another Trello mutation. The exact
returned marker location must be proven with a controlled development canary
before echo suppression is activated.

Ambiguous create outcomes are not blindly retried. Cards carry a non-secret
MoMi task reference in their description so reconciliation can find an object
whose response was lost. Desired-state updates may retry idempotently and all
attempts remain durable.

The initial authorized reconciliation resolves board short ID `qdzZg93X` to a
canonical board ID, preserves existing cards, and proposes the list order
`Unassigned`, `Today`, `In Progress`, `Blocked`, `Done`. It does not mutate the
board without a separately approved activation.

Credential values are never stored in Git, issue text, logs, audit payloads, or
task prompts. Opaque names `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, and
`TRELLO_WEBHOOK_SECRET` are entered directly in the existing Supabase secret
UI only after code review. `TRELLO_WEBHOOK_CALLBACK_URL` and
`TRELLO_CLIENT_IDENTIFIER_PREFIX` are non-secret configuration. Canonical
Trello resource IDs live in the owning datasets, not environment variables.

## Consequences

- Staff can continue working in Trello while MoMi retains durable authorship,
  timestamps, identity mappings, and state transitions.
- A first-party task UI can replace Trello without changing canonical task IDs
  or rewriting audit history.
- Webhook delivery is authenticated, replay-safe, and loop-safe without treating
  public correlation metadata as a secret.
- Deployment, credentials, webhook registration, list creation, and live board
  mutations remain separate explicitly authorized steps.
