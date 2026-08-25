# Toast Order Hydration

## ELI5

MoMi may have a deliberate reconciliation job for one Toast order. This service
claims that job, asks Toast for exactly that order, and saves the whole answer.
Normal order webhooks do not create these jobs.

## Purpose

This is the retiring order-specific adapter for explicit hydration, idempotent
response storage, and fetch attempt history. `toast-data-acquisition` is the
permanent outbound Toast owner. This service is not on the operational
webhook-to-Slack path and accepts no new acquisition responsibilities.

## Owned Function

`toast-orders-fetch-by-guid-v1` performs one configured operation:
`GET /orders/v2/orders/{guid}`. It is not a generic Toast proxy.

## Contracts

The service provides the complete source operation. Its legacy direct write to
order-alerting work is frozen as runtime access debt, not declared as an
authorized procurement dependency. It is an indirect producer of downstream
invocation work, not a consumer of the read contract.

A job may target the retiring `momi.toast_orders.get_by_id.v1` contract only
through a separately approved, bounded reconciliation or operator workflow
that names the historical order or work, owner, reason, environment, and
maximum job set. Automatic webhook, normal, bulk, speculative, and open-ended
legacy issuance are prohibited.

Before the read facade can retire, creation of legacy-targeted jobs is fenced
first. Every matching hydration job and attempt must then be terminal or
explicitly dispositioned, with no claimed, running, or late completion able to
insert more legacy invocation work. Unknown or unfinished hydration preserves
the existing read path and the `retiring` classification.

## Authority

Toast host and restaurant values come from database configuration. Secret names
are configured; values remain in Supabase. This adapter retains a temporary
Toast credential and API exception only while its manifest is `retiring`. No
report or read path invokes it synchronously.

## Verification

Run `npm run check -- --service toast-order-hydration` with Node.js 24.
