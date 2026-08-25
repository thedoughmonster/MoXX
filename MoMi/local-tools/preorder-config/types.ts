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
  schema_version: 1 | 2 | 3;
  publication_ref: string;
  publication_mode: "draft" | "active" | "inactive";
  surface: { surface_key: string; enabled: boolean };
  pickup_policy: {
    horizon_days: number;
    cutoff_hours?: number | null;
    schedule_mappings?: Array<{
      schedule_key: string;
      iso_weekdays: number[];
      starts_local: string;
      ends_local: string;
    }>;
    ordering_cutoff?: {
      mode: "previous_day_local_time";
      local_time: string;
    };
  };
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
  releaseReceiptPath?: string;
  execute: boolean;
};

export type ReleaseIdentity = {
  headSha: string;
  headTree: string;
  receiptPath: string;
};

export type PublicationReadback = {
  publication_ref: string;
  config_digest: string;
  publication_mode: "draft" | "active" | "inactive";
  resulting_version: number | null;
  surface_enabled: boolean | null;
  active_publication_matches: boolean;
  price_class_count: number;
  item_policy_count: number;
  schedule_day_count: number;
  catalog_item_count: number;
  window_count: number;
  contract_valid: boolean;
};

export type PublicationExecution = {
  receipt: Record<string, unknown>;
  readback: PublicationReadback;
};

export type OperatorReceipt = {
  schema_version: 1;
  run_id: string;
  environment: "dev" | "prod";
  project_ref: string;
  publication_ref: string;
  publication_mode: "draft" | "active" | "inactive";
  config_sha256: string;
  release_head_sha: string;
  release_head_tree: string;
  started_at: string;
  completed_at?: string;
  status: "started" | "succeeded" | "failed";
  readback?: PublicationReadback;
};
