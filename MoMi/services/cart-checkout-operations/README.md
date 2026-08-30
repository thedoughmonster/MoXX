# Cart and Checkout Operations

## ELI5

Every way a customer starts shopping adds to the same draft order. The cart is
the safe view of that draft, and checkout continues the same identity instead
of opening another order.

## Boundary

This capability owns shared draft identity and versioning, cart presentation
state, checkout progression and recovery, and immutable order-change
references. Entry flows retain their own product, eligibility, pricing,
fulfillment, capacity, cutoff, disclosure, and revalidation rules.

The event router receives only identity and an owner-read reference. It never
receives cart lines, customer contact, payment material, credentials, provider
payloads, or policy bodies.

## Implementation and compatibility posture

The service and its version-one shapes are declared, not implemented or hosted.
There are no functions, routes, relations, routines, subscriptions, deployment
units, secrets, or runtime writer. The declared Ajv dependency supports the
contract fixture test only. Contract keys are reserved and non-callable until
later implementation manifests bind them.

`preorder-operations` remains the sole active writer for the existing preorder
public v1 surface. Its contract keys and route shapes remain active and
unchanged; later cutover work must be additive and prove one active writer.
