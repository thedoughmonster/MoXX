# Kitchen Task Management

## ELI5

This is MoMi's permanent kitchen task ledger. Trello may display and update the
work today, but this service remembers the real task, who changed it, and when.

## Boundary

The service owns recurring templates, daily task instances, assignment,
checklists, workflow state, identity mappings, external references, desired
Trello state, and append-only audit events. It reads only immutable archive
evidence through a purpose-bound contract and sends only prepared operations to
the Trello delivery adapter.

Runtime relations, processors, schedules, and subscriptions land in later
additive changes and remain disabled until their release is authorized.
