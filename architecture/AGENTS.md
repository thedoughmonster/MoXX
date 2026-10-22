# MoXX Architecture Agent Contract

## Ownership

This directory owns the repository-wide LikeC4 model and its generated
architecture dashboard. It describes the product across `MoXi/`, `MoMi/`, and
external dependencies without taking ownership away from those systems.

## Lifecycle truth

- Every modeled element must carry exactly one of `#discovery`, `#planned`, or
  `#implemented`.
- `#discovery` means the boundary, ownership, contract, or technology remains
  unresolved. It is not a delivery commitment.
- `#planned` means the architecture decision has been accepted, but operational
  implementation has not been verified.
- `#implemented` requires current evidence in the owning repository or deployed
  environment. Historical data alone does not prove a live service exists.
- Additional descriptive tags such as `#legacy` are allowed but never replace
  the lifecycle tag.
- Promote lifecycle state only when the corresponding decision or verification
  evidence exists. If evidence becomes stale or contradictory, downgrade the
  element rather than preserving an optimistic status.

## Modeling rules

- Update the model as discovery decisions settle; do not wait for final issue
  decomposition.
- Keep unresolved alternatives explicit and visually distinct.
- Model capability boundaries before deployment topology unless deployment is
  verified.
- Preserve traceability from user-facing behavior to APIs, calculations, source
  data, and external evidence.
- Do not place secrets, credentials, private invoice content, or personal data
  in the model.

## Validation

Run `pnpm check` from this directory before handoff.
