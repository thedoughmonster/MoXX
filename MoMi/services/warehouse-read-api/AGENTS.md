# Warehouse Read API Rules

- Expose only Dough Monster canonical contracts and identifiers.
- Never return a source DTO or require a source-system identifier.
- Include provenance and freshness without making either source-specific.
- Exact raw reconstruction belongs to privileged archive tooling.
- Every read requires and atomically consumes an owned durable capability token.
