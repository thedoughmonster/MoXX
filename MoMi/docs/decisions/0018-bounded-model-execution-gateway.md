# 0018: Bounded model execution gateway

- Status: accepted
- Date: 2026-07-25
- Owning issues: #179 and #180

## Context

Communications, communications evaluation, and issue triage each execute an
OpenAI request directly. That duplicates credential custody, transport policy,
request identity, usage accounting, and ambiguous-outcome handling. It also
ties background response polling to the lifetime of the originating request.

## Decision

Create `model-execution-gateway` as the only service allowed to hold an OpenAI
credential or call `api.openai.com`. It owns mapped purpose/profile selection,
physical provider requests, per-call ceilings, idempotency, provider identities,
and a content-free metadata ledger. Prompts, tools, evidence bodies, user policy,
and domain effects remain with their caller.

Allow one exact internal HTTP contract from the three declared callers to
`momi-model-execution-gateway-v1`. Requests use one purpose-bound caller secret,
an idempotency key, a parent invocation, a mapped purpose/profile, and a bounded
provider payload. The gateway rejects caller-supplied models, endpoints,
reasoning levels, credentials, and arbitrary HTTP methods. This is a narrow
exception to ADR `0004`; no other service-to-service HTTP path is authorized.

The gateway stores identifiers, state, timing, status, token usage, calculated
cost, and allowlisted provider headers. It never stores authorization headers,
credentials, webhook secrets, or full request/response bodies. A caller owns
and archives its full model-visible evidence through its existing contracts.

Issue triage keeps its serialized durable queue and schema-constrained result,
but replaces direct `openai/codex-action` execution with this same contract.

## Activation and rollback

Callers retain their current domain admission and idempotency gates. Cutover is
per caller after a development canary. Rollback restores caller routing to the
previous release while preserving the gateway ledger. No rollback may repeat an
ambiguous paid request.

Issue #180 adds a signed OpenAI webhook and durable late-completion path. It may
mark only a call already admitted by this gateway; unknown and pre-cutover
events are acknowledged without a domain effect.

## Consequences

One boundary now owns provider execution and metadata. The temporary internal
HTTP exception is explicit, testable, and deny-by-default. Domain services keep
their existing ownership and do not gain access to another owner's private
tables.
