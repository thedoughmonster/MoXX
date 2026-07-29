# Trello Task Delivery

## ELI5

This service receives a finished instruction such as “move this card” and sends
it to Trello once. It records the outcome but never decides which task or person
should change.

## Boundary

The destination adapter owns prepared Trello mutation work, delivery attempts,
rate-limit retries, ambiguous outcomes, and success references. It emits only
reference-based outcomes and cannot read kitchen task truth.

The runtime slices accept durable prepared `create_list`, `move_card`, and
`register_webhook` operations. Registration requires opaque references to a
fresh acquisition-owned inventory and a successful callback HEAD probe. The
service records complete responses and marks uncertain mutation outcomes
ambiguous instead of retrying them.
