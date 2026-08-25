# Workflow authority

GitHub activates workflow files only from this root directory. The imported
`MoMi/.github/workflows/` and `MoXi/.github/workflows/` directories are retained
as source-history reference material and are not execution authorities in MoXX.

Root workflows route product commands through `MoMi/` or `MoXi/` explicitly.
Backend deployment apply remains limited to `deploy-dev.yml` and
`deploy-prod.yml`; UI deployment remains limited to the two Cloudflare workflows.
Secret values are never stored here: workflows reference repository or
environment secrets by name.
