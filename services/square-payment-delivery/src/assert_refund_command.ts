import type { RefundCommand } from "./types.ts"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertRefundCommand(command: RefundCommand): void {
  if (!uuid.test(command.refund_attempt_id) || !uuid.test(command.owner_order_id)) {
    throw new Error("invalid_refund_identity")
  }
  const invalid = !command.provider_payment_id ||
    command.provider_payment_id.length > 192 ||
    !Number.isSafeInteger(command.amount_minor) || command.amount_minor < 1 ||
    command.currency !== "USD" || !command.location_id ||
    command.location_id.length > 64
  if (invalid) throw new Error("invalid_refund_command")
}
