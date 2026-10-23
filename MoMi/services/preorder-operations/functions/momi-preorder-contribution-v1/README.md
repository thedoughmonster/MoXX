# Preorder Contribution V1

## ELI5

This is the preorder policy checker used by a shared cart. It rebuilds the
selected product and pickup facts from current owner data and lists every
customer-visible correction before checkout may continue.

## Trigger And Input

An anonymous bounded `POST` supplies a surface key, pickup date, and the
versioned preorder contribution being restored or edited.

## Output

The response is accepted only when the supplied selection exactly matches the
current product, options, fulfillment, price, full-payment rule, rule versions,
and disclosures. Otherwise it returns typed, accessible corrections.
Unexpired evidence may retain an earlier expiry than a fresh owner read;
expired evidence or expiry beyond the current owner bound requires refresh.

## Side Effects

The request records only the existing content-free rate-limit bucket. It does
not create a cart, hold, order, customer record, or payment.

## Failure Handling

Missing configuration, stale evidence, cutoff, sold-out capacity, ineligible
items, invalid options, allergens, and quantity violations fail closed.

## Tests

Node tests cover current acceptance, material corrections, unavailable policy,
privacy, and compatibility with the shared cart reference shape.
