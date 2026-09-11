# Cart and Checkout Operations Rules

- Own the source-neutral draft-order, cart, checkout, recovery, and immutable
  order-change-reference contracts declared by ADR 0033.
- Keep one draft order, cart view, and checkout progression on one `order_id`.
- Require stable command identity and expected-version fencing for mutations.
- Orchestrate flow-owner revalidation; never copy eligibility, pricing,
  fulfillment, capacity, cutoff, or disclosure policy into this capability.
- Keep cart, customer, payment, credential, provider, and policy bodies out of
  order-change references and event-router payloads.
- Treat declared contracts as non-callable until functions or routines are
  separately accepted and bound in manifests.
- Preserve the active preorder public v1 writer until an additive cutover proves
  exactly one replacement writer.
