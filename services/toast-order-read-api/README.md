# Toast Order Read API

## ELI5

This service opens an exact Toast order saved by webhook or hydration and hands
back the full document plus a readable presentation. It never asks Toast for
anything.

## Purpose

This implemented, retiring source-specific read facade protects the warehouse
boundary. Its availability is not asserted from repository evidence. It
validates durable work capability, reads an approved versioned view, and
returns the complete source payload separately from its source-neutral
presentation. It owns no dataset.

## Owned Function

`momi-toast-orders-get-by-id-v1` keeps its existing route and contract. A future
Square reader can provide its own source contract without changing Toast history.

## Contracts

The service provides `momi.toast_orders.get_by_id.v1`. `order-alerting` is its
only permitted current service consumer, and only for already-created legacy
invocation work plus bounded repair or rollback compatibility. New service
consumers and automatic or normal legacy work are prohibited. The facade
consumes `momi.warehouse.toast_order_read_view.v1` from `warehouse-projection`
for its one approved database view.

`toast-order-hydration` is an indirect producer, not a consumer. It may target
this contract only through a separately approved, bounded operator or
reconciliation job tied to named historical work. Bulk, speculative, and
open-ended legacy issuance are prohibited.

## Retirement

The service remains `retiring` until the canonical reader passes controlled
acceptance, every consumer and executable legacy branch is removed, hydration
creation is fenced and its jobs and attempts are drained or dispositioned,
legacy invocation work is drained, the route and registries are inactive,
invocation readback has no unexplained calls, and documentation agrees. Any
unknown caller, unfinished or late hydration, unresolved work, registry
ambiguity, or canonical failure preserves the existing path. Unhosting or
removal requires separate operational authority.

## Authority

The service may read `momi_orders` authorization work and `momi_api` views. It
cannot write durable state or call Toast, Slack, or another external API.

## Verification

Run `npm run check -- --service toast-order-read-api` with Node.js 24.
