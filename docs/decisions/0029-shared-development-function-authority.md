# 0029: Declare shared development Edge Function authority

- Status: accepted
- Date: 2026-08-23
- Owning issue: MOX-344

## Context

The development Supabase project contains three active functions owned by the
dedicated `thedoughmonster/momi-symphony` repository:

- `momi-agent-control-dispatch-v1`
- `momi-agent-control-linear-webhook-v1`
- `momi-decision-alert-delivery-v1`

That repository declares the owning services active. Its protected
`.github/workflows/deploy-dev.yml` is the sole development deployer and is
pinned to the same project ref as this repository. Hosted entrypoints and
bundle metadata identify its adapters. MOX-233 records the agent-control
cutover and active caller mapping; MOX-232 records controlled webhook and
decision-delivery acceptance.

Retirement manifests cannot represent this state: they are temporary authority
to remove a function after caller verification, while these functions remain
active under another repository.

## Decision

Development-only external-function authority manifests declare each shared
function's repository, service, lifecycle, caller state, project, workflow,
source revision, adapter path, and JWT posture.

Each authority is valid only through its declared `valid_until` date. Renewal
requires re-verifying the owner, lifecycle, caller state, shared project,
protected workflow, and immutable owner revision. Invalid calendar dates,
future verification dates, inverted ranges, and expired authority fail
architecture validation before inventory or release work begins.

The hosted inventory gate treats applicable external functions as required. It
fails when one is missing or when status, version, bundle hash, JWT posture, or
owner-repository entrypoint metadata is invalid. The backend release may list
and attest them, but never selects, deploys, probes, retires, or deletes them.

No production authority is granted. External production hosting requires a
separate ADR and schema change. Removal remains caller-verified, explicit, and
owned by the external repository's protected authority; neither repository may
use prune.

## Consequences

Hosted parity now means every function in the shared project has one explicit
active local owner, unexpired external authority, or unexpired retirement
authority. Cross-repository functions cannot become a silent inventory bypass,
and backend releases cannot mutate Symphony-owned runtimes.
