# Preorder Bootstrap V1

## ELI5

This is the public menu board. It returns only the current products, pickup
windows, prices, and policies that a preorder customer is allowed to see.

## Trigger And Input

An anonymous browser sends `GET` with a required `surface_key` and an optional
`fulfillment_date`. The route also accepts browser CORS preflight requests.

## Output

The function returns the frozen `momi.preorder.bootstrap.read.v1` response with
request metadata and customer-safe data from the owner routine.

## Side Effects

Each attempted read increments a bounded, content-free one-minute rate bucket.
It does not create a cart, quote, hold, order, or payment attempt.

## Failure Handling

Malformed requests fail closed. Disabled or unknown surfaces return a safe
conflict, the bounded anonymous limit returns `429`, and database failures
return `503` without exposing private details.

## Tests

Node tests cover input parsing, CORS, success, rate limiting, disabled surfaces,
and failure responses. Migration tests pin private-schema, RLS, and grant rules.
