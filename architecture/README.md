# MOXX architecture

This directory contains the living LikeC4 model for the MOXX product. The
generated site is an architecture dashboard, not a source of runtime state.

## Lifecycle states

Every element has exactly one lifecycle tag. Lifecycle is deliberately separate
from ownership color:

- **Discovery** (`#discovery`, dotted border): under active discovery; boundaries or
  decisions remain unresolved.
- **Planned** (`#planned`, dashed border): accepted architecture that has not yet been
  verified as operational.
- **Implemented** (`#implemented`, solid border): verified current behavior or data.

Color identifies ownership: green is MOXX-owned, indigo is a managed platform,
and gray is a third party. The optional `#legacy` tag reduces opacity for
retained historical evidence; it does not replace a lifecycle tag.

Promote `discovery` to `planned` only after an architecture decision is
accepted. Promote `planned` to `implemented` only after checking the owning
repository or deployed environment.

## Commands

```bash
pnpm install
pnpm check
pnpm dev
```

The development dashboard listens only on `127.0.0.1:5174` by default. Override
that safely with `LIKEC4_HOST` and `LIKEC4_PORT`; the service must remain
loopback-only when published through Cloudflare Tunnel. No tunnel credentials
belong in this repository.

The protected production entry point is
[`architecture.doh.monster`](https://architecture.doh.monster). Its existing
Cloudflare route remains on the `symphony-dashboard-ovh-vps` tunnel and points
to `127.0.0.1:4120`. Do not change that route until this directory has been
deployed and verified on the tunnel host. Keeping the old origin live until
then makes the source migration non-disruptive.

## Current scope

This is the single repository-owned model for the complete MOXX product. It
reconciles the former Watchdog-hosted architecture with the current monorepo and
covers:

- the MoXi, MoMi, and MoSi product planes;
- customer, staff, and ownership experiences;
- all current `MoMi/services/*/service.json` service boundaries;
- source acquisition, canonical data, operations, communications, and governance;
- persistent costing discovery, including cost lookup and invoice maintenance;
- managed platforms and third-party providers.

`pnpm run catalog:check` prevents the modeled service inventory and source links
from drifting away from the current MoMi manifests. Costing remains deliberately
mixed-state: accepted boundaries are planned, unresolved storage/mapping/correction
decisions are discovery, and imported recipe evidence is implemented but legacy.
