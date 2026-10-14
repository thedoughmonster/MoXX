# Wholesale Invoicing Rules

- Follow ADRs 0035/0036 and the exact service manifest; bridge is shared.
- Own only invoice-prefixed declared objects, never unrelated bridge modules.
- Keep standing-order basis explicit; scheduled cases are not delivery evidence.
- Preserve immutable commands, versions and preview revisions.
- Keep one logical weekly identity across configuration and preview revisions.
- Fence writes and previews with the same order-row lock and expected revision.
- Protect invoiced history; an ordinary preview must not freeze future editing.
- Pause changes scheduled cases; Hold sending retains cases and records a hold.
- Use local calendar dates and exact integer minor-unit case prices.
- Keep enabled=false enforced; no network, provider, scheduler or public route.
- Do not grant other runtime roles access or introduce credentials in this slice.
- Defer all runtime roles/grants; use only the existing protected dev release lane.
- No private ledger, customer seed/import, live ClickUp task or sending activation.
- Use only synthetic fixtures and embedded PostgreSQL for local verification.
