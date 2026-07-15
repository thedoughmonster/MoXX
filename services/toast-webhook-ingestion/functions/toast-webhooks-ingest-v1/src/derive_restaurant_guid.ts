import type { ToastWebhookPayload } from "./types.ts"

export function deriveRestaurantGuid(
  payload: ToastWebhookPayload,
): string | null {
  const restaurantGuid = payload.details.restaurantGuid
  return typeof restaurantGuid === "string" && restaurantGuid.length > 0
    ? restaurantGuid
    : null
}
