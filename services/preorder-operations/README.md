# Preorder Operations

## ELI5

This service is the shop clerk for online preorders. It tells the customer what
can be ordered and when, checks the exact price, remembers one order safely,
and reports what happens next. Square handles the money; this service never
handles the card.

## Boundary

preorder-operations owns Dough Monster's public preorder business lifecycle:
surface configuration, announced catalog policy, fulfillment eligibility,
capacity, quotes, holds, order intents, customer-safe status, and change
requests.

The browser uses only the versioned Edge Function routes declared in
contracts/preorder-public-v1.openapi.json. Database objects and functions will
land additively in later issue #226 slices. Until then, the OpenAPI document
and synthetic fixtures are the implementation boundary shared with issue #225.

Square owns payment and financial facts. This service exposes a customer-safe
payment workflow but has no direct Square network or secret authority. Square
adapters introduced under issue #162 must preserve that separation.
