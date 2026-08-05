# 0019: Preorder Contract And Payment Boundary

- Status: accepted
- Date: 2026-07-28

## Context

The first-party preorder launch needs stable public contracts before the browser,
database, and Square integration can be implemented independently. ADR 0013
requires one owner for every dataset and contract-only access between services.
Issue #162 separately establishes Square as the permanent authority for
financial and payment facts.

The launch cannot make the browser a database client or a Square server API
client. It also cannot make Square the owner of Dough Monster's preorder
catalog, availability policy, quote, order intent, or fulfillment commitment.

## Decision

Create preorder-operations as the dataset_owner for the coherent preorder
business lifecycle. It owns:

- public surface and location mappings;
- published preorder catalog and policy versions;
- eligible fulfillment windows, closures, cutoffs, and capacity;
- checkout holds and authoritative quotes;
- preorder intent, customer contact, lifecycle, and fulfillment commitment;
- customer-authorized change requests and their receipts.

The browser calls only versioned Supabase Edge Function contracts provided by
preorder-operations. It never reads tables directly and never receives a
database credential, service-role key, Square access token, or webhook secret.

Square remains authoritative for tokenization, authorization, capture, refund,
settlement, tender, dispute, payout, and Square-managed device facts.
preorder-operations may expose customer-safe payment commands and status, but
it does not call Square directly. The implementation introduced under #162
must put outbound Square mutations behind a destination adapter and provider
observations behind an acquisition boundary. Those adapters return versioned
receipts that preorder-operations reconciles into its customer-safe order view.

No Square adapter service, contract dependency, secret, network host, relation,
or routine is declared by this decision. Those authorities land with their
implementation and must cite this ADR plus #162.

## Public Contract Surface

The version-one browser surface is:

- momi.preorder.bootstrap.read.v1
- momi.preorder.quote.create.v1
- momi.preorder.checkout_hold.manage.v1
- momi.preorder.order_intent.create.v1
- momi.preorder.payment.initiate.v1
- momi.preorder.payment.reconcile.v1
- momi.preorder.order_status.read.v1
- momi.preorder.change_request.submit.v1

The machine-readable source is
services/preorder-operations/contracts/preorder-public-v1.openapi.json.
Contract keys and route paths are immutable within version one. Additive schema
changes require compatibility proof; incompatible changes require new contract
and route versions.

## Correctness Rules

- Every command carries a stable command identity and expected resource version.
- One durable MoMi order intent exists before any paid provider mutation.
- Provider timeout or missing response is pending or indeterminate, never
  success and never permission for a blind paid retry.
- Quote expiry, policy drift, closure, and capacity loss fail closed with typed
  customer-safe outcomes. Allergen uncertainty fails closed when avoidance is
  requested; a general order may retain explicitly unverified evidence without
  making an allergen-safe or avoidance claim.
- Refresh, back navigation, reconnect, callback replay, and webhook duplication
  cannot duplicate an order or charge.
- Realtime is advisory. Durable read and reconciliation contracts remain the
  correctness path.
- Raw payment credentials never enter MoMi. The online interface may submit only
  a Square-hosted single-use token to the payment-initiation contract.
- Payment tokens and customer data are prohibited from general logs, Sentry,
  fixtures, issue text, and command receipts.

## Delivery Order

1. Freeze and test the OpenAPI contract plus synthetic acceptance fixtures.
2. Add the smallest private schema, owner tables, routines, RLS, and grants.
3. Implement bootstrap, quote, hold, and durable order-intent contracts.
4. Add the Square adapter boundary under #162.
5. Implement payment initiation, webhook acquisition, reconciliation, status,
   and customer-authorized changes.
6. Prove the synthetic flow in Square Sandbox before production activation.

## Consequences

- The public preorder UI can proceed against fixtures without waiting for hosted
  payment infrastructure.
- MoMi keeps non-financial business authority while Square keeps financial
  authority.
- Provider replacement or later MoMi canonicalization does not change the
  browser contract.
- The launch adds one coherent business owner instead of a generic commerce
  service.
