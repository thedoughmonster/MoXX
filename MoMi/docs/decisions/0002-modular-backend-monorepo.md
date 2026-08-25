# 0002: Use A Modular Backend Monorepo

- Status: accepted
- Date: 2026-07-12

## Context

MoMi backend capabilities share one Supabase project and one ordered database
migration history. Splitting each small service into a repository would require
coordinating schema and code changes across repositories without adding useful
ownership or release isolation at the current scale.

Splitting migrations, server code, and contracts by artifact type would make
atomic review and deployment harder.

## Decision

Use `momi-backend` as a modular monorepo for backend services, Supabase Edge
Functions, migrations, tests, and contracts.

Keep runtime modules independently understandable and deployable. Organize them
by business capability, not file type. Raw ingestion, alert eligibility, and
notification delivery retain separate contracts and side-effect boundaries.
Each deployable service has one named directory and one clear entrypoint.

Create another repository only for a product surface or service with a truly
independent release lifecycle, access boundary, or operational owner.

## Consequences

- Schema and supporting code can change in one reviewed commit.
- Supabase `dev` and `prod` follow one Git history.
- Shared tooling and contracts do not need cross-repository synchronization.
- Module boundaries must be enforced through contracts and directory ownership.
- A module can be extracted later without changing its external contract.
