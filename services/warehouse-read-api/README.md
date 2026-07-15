# Warehouse Read API

## ELI5

This service gives other MoMi services a clean Dough Monster record, regardless
of which cash register system originally supplied it.

This core capability serves stable Dough Monster entities from the canonical
warehouse. Source adapters may change without changing these contracts.

HTTP contracts cover canonical orders, payments, menu entities, employees,
schedules, and latest stock observations. The five warehouse entity routes
share one reader implementation while retaining independent manifests,
registrations, and versioned `momi.*` contracts.

Every response contains a normalized document plus provenance and freshness.
Callers provide only Dough Monster UUIDs and an expiring, one-use durable read
token; upstream DTOs and source identifiers are never request requirements.

The legacy source reader remains separate during order-alert migration.
Run `pnpm check` from the repository root.
