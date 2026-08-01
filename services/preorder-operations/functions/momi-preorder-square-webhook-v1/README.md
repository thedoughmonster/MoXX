# MoMi Preorder Square Webhook v1

## ELI5

This endpoint proves a Square message is genuine, archives it once, and safely
updates the matching preorder payment.

## Trigger And Input

Square posts exact raw JSON bytes with its HMAC signature header. The request is
bounded to 256 KiB before authentication work.

## Output

Successful processing returns only an acknowledgement and a safe disposition;
it never returns provider, payment, order, or customer data.

## Side Effects

Authenticated evidence is durably archived and deduplicated before the Logic
resolver and projection routines update an exact payment attempt.

## Failure Handling

Invalid signatures fail closed. Durable or retryable provider failures return a
server error so Square can retry; unowned evidence is archived and acknowledged.

## Tests

Focused tests cover byte ordering, authentication, archival ordering, retries,
unmatched identities, privacy, and body-size admission.
