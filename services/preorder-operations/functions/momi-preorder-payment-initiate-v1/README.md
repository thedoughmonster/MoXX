# MoMi Preorder Payment Initiation v1

## ELI5

This endpoint safely connects one already-created preorder to one Square payment
attempt without allowing a double charge.

## Trigger And Input

The browser posts the public `momi.preorder.payment.initiate.v1` request with an
order-bound recovery authority header and one in-memory Square source token.

## Output

It returns only the customer-safe payment receipt. Pending and indeterminate do
not mean paid.

## Side Effects

The handler admits the request, durably claims an attempt, calls the public
Square execution contract once, and projects sanitized evidence into preorder
truth.

## Failure Handling

Replay, busy, and terminal claims never call Square. Provider ambiguity is
durably projected as indeterminate; no automatic recharge occurs.

## Tests

Focused tests cover strict input, rate admission, call ordering, replay, privacy,
and ambiguous provider recovery.
