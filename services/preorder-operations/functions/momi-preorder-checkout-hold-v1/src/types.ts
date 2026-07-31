export const functionKey = "momi.preorder.checkout_hold.manage.v1";

export type HoldInput = {
  command_id: string;
  action: "create" | "recover" | "expire" | "release";
  quote_id: string;
  expected_quote_version: number;
  hold_id?: string;
};

export type Failure = {
  code: string;
  message: string;
  retryable: boolean;
  next_action: string;
};

export type HoldResult = {
  outcome: string;
  hold_id?: string;
  hold_version?: number;
  hold_status?: string;
  expires_at?: string;
  error?: Failure;
};

export type HoldExecution = {
  admitted: boolean;
  result: HoldResult | null;
};

export type HoldExecutor = (
  input: HoldInput,
  authority: string,
) => Promise<HoldExecution>;
