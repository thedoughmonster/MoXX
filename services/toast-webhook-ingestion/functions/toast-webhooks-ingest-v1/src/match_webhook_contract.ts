import type { WebhookContract } from "./types.ts"

const registeredContracts: Record<string, WebhookContract> = {
  "order_updated\0order_updated": {
    subscriptionKey: "orders",
    secretName: "TOAST_ORDERS_WEBHOOK_SECRET",
  },
  "channel_order_updated\0channel_order_updated": {
    subscriptionKey: "orders",
    secretName: "TOAST_ORDERS_WEBHOOK_SECRET",
  },
  "stock\0in_stock": {
    subscriptionKey: "stock",
    secretName: "TOAST_STOCK_WEBHOOK_SECRET",
  },
  "stock\0low_quantity": {
    subscriptionKey: "stock",
    secretName: "TOAST_STOCK_WEBHOOK_SECRET",
  },
  "stock\0out_of_stock": {
    subscriptionKey: "stock",
    secretName: "TOAST_STOCK_WEBHOOK_SECRET",
  },
  "menus\0menus_updated": {
    subscriptionKey: "menus",
    secretName: "TOAST_MENUS_WEBHOOK_SECRET",
  },
  "packaging\0packaging_updated": {
    subscriptionKey: "packaging",
    secretName: "TOAST_PACKAGING_WEBHOOK_SECRET",
  },
  "partner\0packaging_updated": {
    subscriptionKey: "packaging",
    secretName: "TOAST_PACKAGING_WEBHOOK_SECRET",
  },
  "restaurant_availability\0availability_online": {
    subscriptionKey: "restaurant-availability",
    secretName: "TOAST_RESTAURANT_AVAILABILITY_WEBHOOK_SECRET",
  },
  "restaurant_availability\0availability_offline": {
    subscriptionKey: "restaurant-availability",
    secretName: "TOAST_RESTAURANT_AVAILABILITY_WEBHOOK_SECRET",
  },
  "restaurant_availability_toggle\0toggle_availability_online": {
    subscriptionKey: "restaurant-availability",
    secretName: "TOAST_RESTAURANT_AVAILABILITY_WEBHOOK_SECRET",
  },
  "restaurant_availability_toggle\0toggle_availability_offline": {
    subscriptionKey: "restaurant-availability",
    secretName: "TOAST_RESTAURANT_AVAILABILITY_WEBHOOK_SECRET",
  },
  "ordering_schedule\0ordering_schedule_updated": {
    subscriptionKey: "ordering-schedule",
    secretName: "TOAST_ORDERING_SCHEDULE_WEBHOOK_SECRET",
  },
}

export function matchWebhookContract(
  eventCategory: string,
  eventType: string,
): WebhookContract | null {
  return registeredContracts[`${eventCategory}\0${eventType}`] ?? null
}
