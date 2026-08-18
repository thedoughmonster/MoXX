# Archive Governance

Owns operational proof that required archive evidence exists and was exported.

## ELI5

This service is the archive checklist. It records what evidence is missing,
which exports ran, and whether manual evidence is sufficient without becoming
the archive that stores the source records.

## Current boundary

The service is active and implemented in the repository. Its derived
availability is `not_asserted`: repository implementation does not mean the
service is hosted, reachable, or callable.

The private implementation consists only of:

- `momi_archive.product_gap_register`
- `momi_archive.export_runs`
- `momi_archive.product_export_status_v1`
- `momi_archive.manual_export_findings_v1`
- `momi_archive.reject_export_run_mutation()`

There are no current functions, public reads, public commands, provided or
consumed contracts, runtime routes, or role bindings. Operator procedures do
not grant identity, credentials, permissions, or runtime authority.

Source evidence remains owned and stored by the source archive services;
Archive Governance keeps only governance records and immutable evidence
references. Any future service client requires a separately accepted versioned
owner contract and separately authorized runtime and role work.
