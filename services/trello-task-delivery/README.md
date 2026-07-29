# Trello Task Delivery

## ELI5

This service receives a finished instruction such as “move this card” and sends
it to Trello once. It records the outcome but never decides which task or person
should change.

## Boundary

The destination adapter owns prepared Trello mutation work, delivery attempts,
rate-limit retries, ambiguous outcomes, and success references. It emits only
reference-based outcomes and cannot read kitchen task truth.

The first runtime slice accepts a durable prepared `create_list` operation. It
records complete responses and marks uncertain outcomes ambiguous instead of
retrying them. It remains undeployed until credentials and release are
separately authorized.
