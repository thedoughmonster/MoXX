# 0005: Use Capability Service Workspaces

- Status: accepted
- Date: 2026-07-13

## Context

MoMi backend capabilities share two environment-specific Supabase projects and
one ordered migration history. Edge Function source previously lived entirely
under `supabase/functions`, which made deployment location appear to be the
primary ownership boundary.

Agentic development needs smaller context surfaces and mechanically enforced
authority. Splitting repositories or Supabase roots would instead distribute
one database lifecycle across several release and configuration boundaries.

## Decision

Keep one `momi-backend` repository and one canonical `supabase` root. Put each
business capability in `services/<service-key>`, including its implementation,
contracts, tests, manifest, documentation, and local agent rules.

Keep only deployment adapters and their pinned Deno configuration under
`supabase/functions/<slug>`. An adapter registers exactly one service handler
and contains no business behavior.

Services own capabilities, not individual files. A cohesive service may own
more than one function. Runtime code may not import another service's
implementation. Versioned public contracts are the only permitted
cross-service source import and must be declared by both services.

One ordered `supabase/migrations` directory remains authoritative. New
migrations declare a service owner. Files already present on `prod` are
immutable.

Shared packages require an accepted ADR, explicit ownership, and either three
stable consumers or an earlier security-critical need. A generic `utils`
package is forbidden.

GitHub Actions and the repository deployment orchestrator are the normal
deployment authority. Supabase's GitHub connection may provide visibility but
must not perform an overlapping deployment.

## Extraction Criteria

A service may move to another repository only when it has all of these:

- an independent runtime or Supabase project;
- an independent migration lifecycle;
- an independent release cadence and access boundary;
- a versioned external contract;
- no direct ownership dependency on this repository's database objects.

## Consequences

- Agents can work inside one capability without tracing unrelated functions.
- CI can enforce network, secret, database, and import authority from manifests.
- Supabase deployment remains conventional and uses one migration stream.
- Small duplication is preferred over premature shared abstractions.
- Service moves must preserve endpoint slugs and behavior independently.
