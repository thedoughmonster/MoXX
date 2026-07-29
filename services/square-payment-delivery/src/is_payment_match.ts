import type { PaymentCommand, SquarePayment } from "./types.ts"

export const isPaymentMatch = (
  payment: SquarePayment,
  command: PaymentCommand,
  locationId: string,
): boolean => payment.reference_id === command.momi_order_id &&
  payment.location_id === locationId &&
  payment.amount_money?.amount === command.amount_minor &&
  payment.amount_money.currency === command.currency
