export const functionKey = "momi.preorder.quote.create.v1";

export type QuoteInput = {
  command_id: string;
  surface_id: string;
  fulfillment_window_id: string;
  versions: {
    surface_version: number;
    catalog_version: number;
    policy_version: number;
    mapping_version: number;
  };
  cart_version: number;
  avoided_allergens: string[];
  lines: Array<{
    line_id: string;
    item_id: string;
    item_version: number;
    quantity: number;
    choice_ids: string[];
  }>;
};

export type QuoteResult = {
  outcome: "accepted" | "rejected" | "conflict";
  quote?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    next_action: string;
  };
};

export type QuoteCreation = {
  admitted: boolean;
  result: QuoteResult | null;
};

export type QuoteCreator = (input: QuoteInput) => Promise<QuoteCreation>;
