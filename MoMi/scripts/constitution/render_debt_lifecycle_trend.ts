import type { DebtLifecycleTrend } from "./debt_lifecycle_types.ts"

export function renderDebtLifecycleTrend(trend: DebtLifecycleTrend): string {
  return `${JSON.stringify(trend, null, 2)}\n`
}
