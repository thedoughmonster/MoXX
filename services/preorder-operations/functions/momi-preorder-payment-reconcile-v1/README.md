# MoMi Preorder Payment Reconciliation v1

## ELI5

This endpoint checks Square for the latest facts about one known payment and
updates the preorder safely.

## Trigger And Input

The browser posts the public reconciliation request with its order-bound
recovery authority and known payment-attempt identity.

## Output

It returns the durable customer-safe payment receipt after reconciliation.

## Side Effects

The handler admits and claims reconciliation, retrieves one known Square
payment through the public adapter contract, and projects sanitized evidence.

## Failure Handling

Missing provider identity requires operator review. Retrieval ambiguity remains
indeterminate and never starts a new charge.

## Tests

Focused tests cover strict owner input, admission, retrieval ordering, non-call
dispositions, and indeterminate recovery.
