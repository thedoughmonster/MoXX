# Toast Stock Ingest

## ELI5

Toast tells MoMi when a menu item changes stock status. This service checks
that the message really came from Toast and saves the whole message.

## Purpose

This source adapter owns webhook authentication and permanent event capture for
Toast menu item stock changes. It does not decide current inventory, alert
anyone, or call another system.

## Owned Function

`toast-stock-webhook-ingest-v1` accepts Toast's signed stock webhook contract
and a health check.

## Contracts

The service provides `toast.stock.webhook_ingest.v1`. The complete source
payload and exact signed body remain in `toast_raw`; request headers are
intentionally discarded.

## Authority

The service may write `toast_raw`, read its webhook secret, and use the
database connection. It has no outbound network authority.

## Verification

Run `npm run check -- --service toast-stock-ingest` with Node.js 24.
