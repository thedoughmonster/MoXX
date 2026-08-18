# Service Status v1

Service status has two independent axes. `lifecycle_status` records the
contract's governance state. `implementation_status` records only the strongest
claim supported by evidence for the exact repository revision and, where
applicable, artifact and environment.

## Transitional Absence And Availability

`implementation_status` is optional only during transition to this model.
Absence means `unclassified`; it never implies `declared`. Availability is
derived, not independently asserted:

| Implementation | Derived availability |
| --- | --- |
| absent (`unclassified`) | `not_asserted` |
| `declared` | `not_asserted` |
| `implemented` | `not_asserted` |
| `hosted_inactive` | `unavailable` |
| `operational` | `expected_available` |

## Evidence Gates

- `declared` requires a valid manifest and stable identity. Bindings may be
  incomplete, declared contracts are not callable, and no runtime state is
  claimed. A partial implementation remains `declared`.
- `implemented` requires every listed function to resolve to owned manifests
  and source, every provided contract to have reviewed public bindings, every
  owned database or deployment artifact to resolve, and repository checks to
  pass for the same revision.
- `hosted_inactive` adds exact artifact-and-environment deployment evidence and
  a disabled, drained, or otherwise no-normal-route control for that artifact.
- `operational` adds exact enablement or route configuration, an allowed-
  consumer policy, and one controlled acceptance or health result for the same
  artifact and environment.

Volatile health observations never change manifest state. Hosting is not a
third axis.

## Transitions

The normal progression is `declared` → `implemented` → `hosted_inactive` →
`operational`. A persisted intermediate may be skipped only when every skipped
gate is satisfied. An `operational` service must first move to
`hosted_inactive` before it is unhosted or withdrawn.

Lifecycle progresses `active` → `retiring` → `retired`. A `retiring` contract
may return to `active` only through an accepted reversal. `retired` is terminal
for the same contract version.

## Cross-product

| Lifecycle | `declared` | `implemented` | `hosted_inactive` | `operational` |
| --- | --- | --- | --- | --- |
| `active` | allowed | allowed | allowed | allowed |
| `retiring` | allowed | allowed | allowed | allowed for named existing consumers only; no new consumers |
| `retired` | allowed | allowed | allowed | forbidden |

Architecture validation rejects `retired` plus `operational` with the service
file and both fields named. Unknown states are rejected by schema validation.
Missing and unknown implementation states cannot be used to infer availability.

## Representative Migration Guidance

These are non-authoritative recommendations for separate, owner-assigned
correction work; they do not classify or amend any service manifest:

- `square-payment-acquisition`, `square-payment-delivery`, and
  `kitchen-task-management` are `declared` candidates;
- `toast-order-read-api` and `order-alerting` are at most `implemented` from
  repository evidence.

None becomes `operational` without exact environment proof. Each remains
absent, and therefore `unclassified`, until evidence and an owner assignment
support a separate correction.

## Rejected Models

The following interpretations are invalid:

- inferring `declared` from a missing `implementation_status`;
- introducing a third hosting boolean or status axis;
- using volatile health as manifest state.
