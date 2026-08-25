# MoXX

MoXX is the product monorepo for the Dough Monster application surfaces.

- `MoXi/` owns user interfaces and browser-facing presentation.
- `MoMi/` owns backend services, database migrations, and backend contracts.

Each directory retains its own toolchain, lockfile, and local `AGENTS.md`.
Run commands from the owning directory unless a root command explicitly says
otherwise.

## Migration status

This repository is being assembled non-destructively from
`thedoughmonster/moxi-web` and `thedoughmonster/momi-backend`. The source
repositories remain authoritative until the monorepo cutover is verified and
recorded. Do not deploy from this repository before that cutover.

The durable migration and control-plane plan is in
[`docs/mox-384-execution-plan.md`](docs/mox-384-execution-plan.md).
