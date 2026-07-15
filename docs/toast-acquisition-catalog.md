# Toast Acquisition Catalog

All operations are registered `GET` calls with bearer authentication and the
restaurant external-ID header. Arbitrary methods, paths, hosts, and parameters
are rejected. Operations flagged `exact_resource_only` are repair-only.
Restaurant detail is intentionally not flagged: its scheduled snapshot supplies
`firstBusinessDate` and management-group discovery for each location.

| Group | Scheduled collections | Repair-only details |
| --- | --- | --- |
| Orders | bulk orders, payments | order GUID, payment GUID |
| Cash | entries, deposits | none |
| Restaurants | management-group members, restaurant detail | none |
| Devices | device collection snapshot | none |
| Kitchen | item fulfillment, prep stations | prep-station GUID |
| Labor | employees, jobs, shifts, time entries | each entity by ID |
| Menus | Menus V2 metadata and full published menu | none |
| Operations | packaging, availability, ordering schedule, stock | none |
| Configuration | all 24 published Configuration V2 resources | 23 GUID endpoints |

Configuration resources are alternate payment types, break types, cash drawers,
dining options, discounts, menu groups, menu items, modifier groups, menus,
no-sale reasons, payout reasons, pre-modifier groups, pre-modifiers, price groups,
printers, restaurant services, revenue centers, sales categories, service areas,
service charges, tables, tax rates, void reasons, and tip withholding.

## Pagination And Limits

- Bulk orders use page/page-size up to 100 and follow `Link`; modified windows
  are at most one month and the endpoint is limited to five requests/second per
  client/location.
- Configuration and prep stations use `Toast-Next-Page-Token`; restart at page
  one after HTTP 409.
- Menus V2 has no pagination and is limited to one request/second per location.
- Payments, cash, and kitchen fulfillment use one business date per request.
- Labor date windows are at most one month. Shifts have no modified-since filter.
- Management-group collections contain strict one-field `{ "guid": "..." }`
  items. Device snapshots are arrays of device objects.

## Schedule Policy

- Recurring schedules are inserted inactive for rollout. A later activation
  migration enables them only after hosted POST canaries pass.
- Menu metadata runs every 30 minutes without an online-ordering capture window.
- Management-group discovery runs daily. A discovered restaurant receives the
  same live, daily, after-close, monthly, and configuration schedules plus an
  idempotent restaurant-detail job that unlocks first-date backfill.
- Pre-activation detail and backfill jobs use an infinite retry time, so they
  remain durable without waking the acquisition worker.

## Exclusions

Do not register writes, deprecated orders GET, price/discount calculators,
Analytics, Credit Cards writes, Menus V3, or provider-facing gift, loyalty, and
tender specifications. Stock search POST and inventory update PUT are excluded;
infer `IN_STOCK` from the current menu universe when an item is absent from the
read-only inventory exception response.

HTTP 403 remains an archived attempt. Device details, kitchen fulfillment, and
employee detail can require product-specific access. HTTP 204 from kitchen
fulfillment is an explicit capability gap, not an empty successful day.
