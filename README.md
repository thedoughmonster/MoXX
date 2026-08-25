# MoXX

MoXX is the product monorepo for the Dough Monster application surfaces.

- `MoXi/` owns user interfaces and browser-facing presentation.
- `MoMi/` owns backend services, database migrations, and backend contracts.

Each directory retains its own toolchain, lockfile, and local `AGENTS.md`.
Run commands from the owning directory unless a root command explicitly says
otherwise.

## Repository authority

MoXX is the sole active product repository. The retained source repositories
are readable history, not development, CI, deployment, or operator authority.
New product work, pull requests, validation, and releases start here.

The durable migration and control-plane plan is in
[`docs/mox-384-execution-plan.md`](docs/mox-384-execution-plan.md).
Root workflow and path-selection behavior is documented in
[`docs/monorepo-automation.md`](docs/monorepo-automation.md).
The source disposition, rollback procedure, and accepted cutover evidence are
recorded in [`docs/mox-390-cutover-receipt.md`](docs/mox-390-cutover-receipt.md).
