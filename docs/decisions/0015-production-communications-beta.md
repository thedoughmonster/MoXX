# 0015: Bounded Production Communications Beta

- Status: accepted
- Date: 2026-07-21
- Evidence packet: `sha256:3a01725031098eeb07d3564ee3e5b7470437f2383c24172ac65673a2af7ca900`

## Context

MoMi needs one provider-neutral assistant in the existing private OpenWebUI
surface. It must use approved canonical shop reads, preserve every model-visible
exchange and committed human message, and append a curated log only when the
authenticated user explicitly asks. Provider spend, identity, immutable
evidence, and persistent UI state make this a production boundary rather than a
synthetic POC.

## Decision

Create `communications-gateway` as the owner of authenticated turn admission,
exact-email access, user limits, deterministic alias-to-provider binding,
idempotent paid-attempt state, tool orchestration, and execution receipts.
Create `communications-operations` as the owner of append-only user-flagged
shop logs. Preserve `communications-archive` as the only immutable evidence
owner and `warehouse-read-api` as the only canonical shop-read facade.

The only visible alias is `momi-assistant`. Gateway state, routes, and cohorts
ship disabled. Before provider egress the gateway must atomically admit an exact
payload under an idempotency key, enforce access and request/rate/token/timeout/
budget limits, and commit archive admission. An ambiguous paid outcome is never
automatically retried. Success is not terminal until the final provider/tool
evidence is archived.

The gateway may call only versioned owner contracts. The approved toolset is
canonical order, payment, menu, schedule, and stock reads plus
`momi.communications.create_user_flagged_shop_log.v1`. Warehouse reads require
an owner-issued, atomically consumed one-use capability. No shell, SQL, generic
HTTP, source API, attachment, plugin, or other business mutation is exposed.

Extend the archive with structured gateway-exchange and human-message capture
contracts plus purpose-bound receipt reads. Extend the read facade only with
bounded canonical beta query contracts. Cross-service HTTP is allowed only from
this gateway to exact manifest-declared MoMi API routes; copied private data and
direct relation access remain forbidden.

Provider credentials stay in the gateway runtime secret store. Relay service
credentials stay in the host credential-file boundary. Neither may appear in
OpenWebUI state, model-visible input, archive or log payloads, ordinary logs,
receipts, configuration artifacts, or source control.

## Activation And Rollback

Repository artifacts, migrations, routes, provider bindings, and cohorts land
inactive. Activation requires reviewed backend release receipts, a bounded host
probe, exact allowlist and limit configuration, secret-negative verification,
and Repo Guard authorization. Rollback disables the cohort and relay and
returns the hostname to the pinned private synthetic foundation without
deleting archive, gateway, curated-log, or OpenWebUI persistent state.

## Consequences

- Each semantic dataset has one owner and only versioned public dependencies.
- Complete model and human communications evidence is immutable and replayable.
- User intent cannot be impersonated by model or system selection.
- Persistent beta state and provider egress require separately owned host and
  secret operations; repository implementation does not authorize them.
