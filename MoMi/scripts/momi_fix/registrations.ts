import type { FixId, FixRegistration } from "./types.ts"

export const momiFixReceiptPath = ".momi/momi-fix-receipt.json"

export const momiFixes = {
  catalog: {
    id: "catalog",
    script: "catalog:generate",
    outputs: ["docs/service-catalog.md"],
    validation_command: "pnpm catalog:check",
  },
  quality: {
    id: "quality",
    script: "quality:generate",
    outputs: ["docs/quality-metrics.json"],
    validation_command: "pnpm quality:check",
  },
  "debt-lifecycle": {
    id: "debt-lifecycle",
    script: "debt-lifecycle:generate",
    outputs: ["docs/debt-lifecycle-trend.json"],
    validation_command: "pnpm constitution:check",
  },
  "legacy-access-report": {
    id: "legacy-access-report",
    script: "legacy-access-report:generate",
    outputs: ["docs/legacy-access-governance-report.json"],
    validation_command: "pnpm legacy-access-report:check",
  },
} as const satisfies Record<FixId, FixRegistration>
