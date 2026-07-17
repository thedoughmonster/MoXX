# Communications Evaluation

Owns durable model evaluation of immutable communication evidence.

## ELI5

This service leases one queued archive item, asks the configured model for a
structured assessment, and stores the decision records without changing the
original evidence.

## Boundary

The service owns evaluation jobs, evaluations, derived records, corrections,
and evaluation audit state. It does not capture source evidence or deliver
routing recommendations to external systems.

The repository manifest declares the target owner before runtime cutover, as
required by ADR `0014`. Existing immutable migrations still register the
function under `communications-archive`; an additive migration must align that
registry before service-specific roles or grants are enforced.
