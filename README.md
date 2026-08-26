# MoXX

MoXX is the product monorepo for the Dough Monster application surfaces.

- `MoXi/` owns user interfaces and browser-facing presentation.
- `MoMi/` owns backend services, database migrations, and backend contracts.

Each directory retains its own toolchain, lockfile, and local `AGENTS.md`.
Run commands from the owning directory unless a root command explicitly says
otherwise.

## Repository authority

MoXX contains the prepared product-repository authority controls. Live cutover
is still pending: the source repositories remain authoritative until their open
work is dispositioned, their README tombstones land, operator mappings move,
and obsolete source workflows are disabled at the recorded cutover time.

The durable migration and control-plane plan is in
[`docs/mox-384-execution-plan.md`](docs/mox-384-execution-plan.md).
Root workflow and path-selection behavior is documented in
[`docs/monorepo-automation.md`](docs/monorepo-automation.md).
The source inventory, rollback procedure, and staged cutover evidence are
recorded in [`docs/mox-390-cutover-receipt.md`](docs/mox-390-cutover-receipt.md).
