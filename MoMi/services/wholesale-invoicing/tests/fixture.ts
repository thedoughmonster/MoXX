export const invoiceFixture = {
  order: {
    environment: "dev", merchant_id: "synthetic-merchant", location_id: "synthetic-location",
    client_id: "synthetic-client", currency: "USD", protected_through: null as string | null,
  },
  version: {
    effective_from: "2026-01-01", paused: false, sending_hold: false, notes: "Weekly agreement",
    lines: [
      { weekday: 1, catalog_item_id: "synthetic-case-a", catalog_version: "1",
        name: "Mixed Case", case_quantity: 2, case_price_minor: 4500,
        catalog_snapshot: { pack_size: 40, assortment: ["A", "B"] } },
      { weekday: 3, catalog_item_id: "synthetic-case-a", catalog_version: "1",
        name: "Mixed Case", case_quantity: 1, case_price_minor: 4500,
        catalog_snapshot: { pack_size: 40, assortment: ["A", "B"] } },
    ],
  },
}
