export const functionKey = "momi.preorder.order_status.read.v1";

export type StatusRead = {
  admitted: boolean;
  data: Record<string, unknown> | null;
};

export type StatusReader = (
  orderId: string,
  authority: string,
) => Promise<StatusRead>;
