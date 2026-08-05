export type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};

export type CatalogItem = {
  item_id: string;
  shop_price_minor: number;
  preorder_price_minor: number | null;
  price_floor_minor: number | null;
  pricing_strategy?: "direct_class" | "highest_active_doughnut_class";
  price_class_key?: string | null;
  preorder_enabled?: boolean;
  eligibility_mode?: "always" | "starts_on" | "ends_on" | "date_range";
  eligible_from_date?: string | null;
  eligible_through_date?: string | null;
  allergen_status: string;
  available: boolean;
  maximum_quantity: number;
};

export type PriceClass = {
  price_class_key: string;
  preorder_price_minor: number;
  price_floor_minor: number | null;
  doughnut_price_class: boolean;
};

export type PreorderConfiguration = {
  schema_version: 1 | 2;
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
  price_classes?: PriceClass[];
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
