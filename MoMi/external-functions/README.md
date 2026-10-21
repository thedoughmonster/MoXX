# Externally owned Edge Functions

These manifests declare retained Edge Functions that another repository owns but
hosts in MoMi's shared development Supabase project. They make each function
required hosted inventory and bind its repository, service, caller state,
deployment workflow, source revision, adapter path, and JWT posture.
Authority expires on `valid_until`; renewal requires re-verifying owner,
lifecycle, caller state, hosting workflow/project, and source revision.

`lifecycle_status: active` describes a supported workflow. `retired_retained`
describes a retired workflow whose functions remain hosted and callable, with
its execution, wake and send controls disabled. It requires `caller.state` to be
`policy_disabled` and `retirement` evidence: the exact owner retirement revision,
verification date, and owner GitHub Actions run URL. The top-level source revision
continues to identify the retained runtime source; a trigger-only retirement does
not redeploy that runtime. See [ADR 0035](../docs/decisions/0035-retained-external-function-lifecycle.md).

`policy_disabled` does not mean an inert receiver or a removed webhook
registration. The retained webhook still authenticates and persists envelopes,
may query Linear before its policy check, and may record rejected or unmatched
dispatches and decision bookkeeping. These records do not assert host shutdown.

Both states retain the same expiry and hosted metadata requirements. A lifecycle
label is not a way to renew an expired record. Before transitioning a record,
verify the successful owner deployment and disabled controls, then re-verify the
retained endpoint's owner, runtime source, caller state and hosting metadata.
Record only observed facts. A proposed change or merged PR is not deployment
evidence, and the validator does not fetch or authenticate the cited run.

The October 21 transitions cite the successful
[owner retirement run](https://github.com/thedoughmonster/momi-symphony/actions/runs/39653140144).
Fresh control-state and retained-source verification supports the
October 21 through November 20 authority window, preserving the original 30-day
duration. The retained runtime revision is unchanged. These record updates
do not change the hosted endpoints.

This repository may inventory these functions. It may not build, select,
deploy, probe, retire, or delete them. A missing function or mismatched hosted
attestation fails parity. Retirement manifests remain temporary authorization
for backend-owned removal and are not an external-ownership substitute.
