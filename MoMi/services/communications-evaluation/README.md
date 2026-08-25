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

The repository manifest declared the target owner before runtime cutover, as
required by ADR `0014`. Additive migration
`20260719180809_align_communications_evaluator_runtime_owner.sql` aligns the
function and route registry records while preserving their activation state.
Service-specific roles, grants, and private-access cutover remain deferred.
