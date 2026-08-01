# Payment Initiation Invariants

- Remove the source token before every database call and never log it.
- Call Square only for a validated `claimed` owner result.
- Project every provider result, including ambiguity, before returning status.
- Never retry provider creation inside this handler.
