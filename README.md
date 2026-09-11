# MoXX

MoXX is the product monorepo for the Dough Monster application surfaces.

- `MoXi/` owns user interfaces and browser-facing presentation.
- `MoMi/` owns backend services, database migrations, and backend contracts.

Each directory retains its own toolchain, lockfile, and local `AGENTS.md`.
Run commands from the owning directory unless a root command explicitly says
otherwise.

## Repository authority

MoXX is the sole active product-repository authority. The retained MoMi and
MoXi source repositories are readable, tombstoned history only; new product
work, CI, deployment, and operator routing belong here.

The durable migration and control-plane plan is in
[`docs/mox-384-execution-plan.md`](docs/mox-384-execution-plan.md).
Root workflow and path-selection behavior is documented in
[`docs/monorepo-automation.md`](docs/monorepo-automation.md).
The source inventory, proof-only rollback procedure, and final cutover evidence are
recorded in [`docs/mox-390-cutover-receipt.md`](docs/mox-390-cutover-receipt.md).
The repository-wide Symphony admission, blocker, ordering, and rollback
contract is documented in
[`docs/symphony-execution-boundary.md`](docs/symphony-execution-boundary.md).
