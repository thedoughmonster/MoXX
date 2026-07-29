# Square Payment Delivery Rules

- Own the only outbound Square Payments API mutation boundary.
- Start paid work only from an already-durable MoMi payment attempt.
- Derive Square idempotency from the stable payment-attempt identity.
- Send exact configured location, order reference, amount, and currency.
- Never persist or log a Web Payments source token or customer payload.
- Treat timeout, malformed response, mismatch, and unknown state as indeterminate.
- Never retry paid work blindly; retrieve or reconcile provider state first.
- Never retrieve provider observations; acquisition owns those reads.
- Never implement Square Terminal or another card-present flow here.
