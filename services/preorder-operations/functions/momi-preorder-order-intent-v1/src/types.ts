export const functionKey = "momi.preorder.order_intent.create.v1";

export type OrderInput = {
  command_id: string;
  quote_id: string;
  expected_quote_version: number;
  hold_id?: string;
  contact: { name: string; email?: string; phone?: string };
};

export type Failure = {
  code: string;
  message: string;
  retryable: boolean;
  next_action: string;
};

export type OrderResult = {
  outcome: string;
  order_id?: string;
  order_version?: number;
  order_status?: string;
  amount_due?: { currency: string; amount_minor: number };
  recovery_authority?: string;
  error?: Failure;
};

export type OrderExecution = {
  admitted: boolean;
  result: OrderResult | null;
};

export type OrderExecutor = (
  input: OrderInput,
  authority: string,
) => Promise<OrderExecution>;
