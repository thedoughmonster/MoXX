# MoXX Agent Contract

## Repository boundaries

- `MoXi/` owns UI and browser presentation. Follow `MoXi/AGENTS.md` for every
  change beneath that directory.
- `MoMi/` owns backend services, database migrations, and backend contracts.
  Follow `MoMi/AGENTS.md` and any more-specific descendant instructions for
  every change beneath that directory.
- Root files own only repository-wide coordination, CI routing, dependency
  automation, and documentation that genuinely applies to both products.

## Hard rules

- Keep UI implementation and backend behavior independently reviewable even
  when they share one repository.
- Do not move business logic into `MoXi` or presentation behavior into `MoMi`.
- Do not create a generic shared package merely because both directories are
  colocated. Shared code still requires an explicit owner and an accepted
  contract.
- Preserve the distinct toolchains and lockfiles. Run package-manager commands
  from the owning directory; there is no root dependency installation.
- Use feature branches or isolated worktrees. Treat `dev` and `prod` as
  protected integration branches.
- Do not deploy, change provider settings, or retire a source repository
  without an explicitly authorized cutover issue and verified rollback path.

## Validation

- A `MoXi/**`-only change runs the MoXi validation contract.
- A `MoMi/**`-only change runs the MoMi validation contract.
- A change spanning both directories runs both contracts and must state the
  versioned interface that connects them.
- Root-only changes run the smallest checks that prove repository routing and
  automation remain correct.

