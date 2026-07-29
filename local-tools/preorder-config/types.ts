export type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};

export type CatalogItem = {
  item_id: string;
  shop_price_minor: number;
  preorder_price_minor: number | null;
  price_floor_minor: number | null;
  allergen_status: string;
  available: boolean;
  maximum_quantity: number;
};

export type PreorderConfiguration = {
  schema_version: number;
  publication_ref: string;
  publication_mode: "draft" | "active";
  surface: { surface_key: string; enabled: boolean };
  pickup_policy: { horizon_days: number; cutoff_hours: number | null };
  savings_policy: {
    advance_tiers: Array<
      { minimum_days: number; multiplier_bps: number | null }
    >;
    quantity_levels: Array<
      { minimum_quantity: number; discount_bps: number | null }
    >;
  };
  capacity_policy: {
    daily_limit: number | null;
    limited_threshold: number | null;
  };
  catalog: CatalogItem[];
  [key: string]: JsonValue;
};

export type CliOptions = {
  environment: "dev" | "prod";
  projectRef: string;
  configPath: string;
  actorRef: string;
  execute: boolean;
};
