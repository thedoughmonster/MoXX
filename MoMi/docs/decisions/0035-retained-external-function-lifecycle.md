# 0035: Represent retained external functions after workflow retirement

- Status: accepted
- Date: 2026-10-21
- Scope: development external-function authority v1

## Context

ADR 0029 represents only active externally owned workflows. An owner may retire
a workflow by disabling its producers and processing policies while preserving
hosted functions and history. Such endpoints can remain callable. Deleting an
authority record or calling the endpoint disabled would misrepresent that state.
MoMi removal manifests would also grant the wrong kind of authority.

## Decision

Add `retired_retained` alongside `active` in external-function authority v1.
The new state means the workflow's execution, wake and send controls are disabled,
and the externally owned endpoint is still retained. It requires
`caller.state: policy_disabled` and a `retirement` object containing:

- `source_revision`: the exact owner revision that implements retirement;
- `verified_at`: the date retirement was verified in the declared environment;
- `evidence_url`: the successful owner GitHub Actions retirement run.

`policy_disabled` describes those controls, not an inert HTTP receiver. The
retained webhook still authenticates and persists envelopes, may query Linear
before policy checks, and may record rejected or unmatched dispatches and
decision bookkeeping. Neither webhook registration removal nor host shutdown
is asserted. Changing these residual behaviors is outside this decision.

The existing top-level `source_revision` still identifies the retained runtime
source. A database-trigger retirement does not imply a function redeployment.
The existing top-level verification date must be on or after retirement
verification. Retirement evidence must belong to the declared owner repository.

Both lifecycle states keep the existing valid-calendar, chronological and expiry
checks. Retention does not make an authority permanent. Any renewal or transition
requires fresh owner, caller, runtime-source, project, protected-workflow and hosted
metadata verification. The schema alone cannot renew a record.

Inventory still requires every applicable retained function and validates status,
version, bundle hash, JWT posture and owner entrypoint. Provider status `ACTIVE`
describes a hosted endpoint, not an active business workflow. The declaration
does not select a function for deployment, probing, removal or reactivation.
Existing conflicts with local ownership and removal manifests still fail.

Before using the new state, an operator must verify successful owner deployment,
disabled workflow controls and retained hosted metadata. A merged PR alone is
insufficient. The schema validates evidence shape and owner binding; it does not
authenticate a workflow run or prove that controls remain disabled. The dated,
expiring record and normal hosted inventory gate remain necessary.

## Consequences

Lifecycle can be represented truthfully without deleting hosted functions or
their audit history. No runtime, permission, credential, deployment owner or
production authority changes. Reactivation or endpoint removal remains a separate
owner action requiring explicit authorization; MoMi has no new mutation authority.

The transitions for the three retained functions cite the successful
[owner retirement run](https://github.com/thedoughmonster/momi-symphony/actions/runs/39653140144)
at revision `d5acffd23a81c311090825e3c125fe65871c966d`. Fresh verification of
disabled controls and retained runtime source supports `verified_at`
October 21 and `valid_until` November 20, preserving the original 30-day window.
Their runtime source revision remains unchanged because retirement did not
redeploy them. These record updates follow fresh verification; the schema alone
does not renew expired declarations.
