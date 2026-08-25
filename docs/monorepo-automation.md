# Monorepo automation routing

All active GitHub automation lives in the repository-root `.github/` directory.
The nested `.github/` directories are retained to preserve imported history but
are inert in the MoXX repository.

Product validation is path-routed:

- `MoMi/**` selects backend validation only.
- `MoXi/**` selects UI validation only.
- A change spanning both selects both and must provide a non-placeholder
  `Interface impact:` statement in the pull request body.
- Root governance validation always checks the routing and workflow structure.

Each product keeps its own package manager version, lockfile, install, and test
commands. Root automation does not install a combined dependency graph. Workflow
commands use `MoMi/` or `MoXi/` working directories, caches use the corresponding
lockfile, and uploaded artifacts use root-prefixed paths.

The only active backend deployment-apply workflows are root
`.github/workflows/deploy-dev.yml` and `deploy-prod.yml`. UI preview checks out
`dev`; UI production checks out `prod`. Provider secrets remain repository or
environment secret references by name and are not copied into the tree.
