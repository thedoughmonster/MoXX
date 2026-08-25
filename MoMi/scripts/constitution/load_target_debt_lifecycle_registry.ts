import { spawnSync } from "node:child_process"

import type { DebtLifecycleRegistry } from "./debt_lifecycle_types.ts"
import { productPathAtRef } from "../git_product_layout.ts"

const path = "docs/debt-lifecycle-registry.json"
const introductionBase = "7fde8a558e18970f2061ab314165bd41b86b3dd0"

export function loadTargetDebtLifecycleRegistry(): DebtLifecycleRegistry | undefined {
  const ref = process.env.MOMI_DEV_REF ?? "origin/dev"
  if (ref !== "origin/dev" && !/^[0-9a-f]{40}$/.test(ref)) {
    throw new Error("MOMI_DEV_REF must be origin/dev or a full commit SHA")
  }
  const result = spawnSync("git", ["show", `${ref}:${productPathAtRef(ref, path)}`], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  })
  if (result.status !== 0 || !result.stdout) {
    const target = spawnSync("git", ["rev-parse", ref], { encoding: "utf8" })
    if (target.status !== 0 || target.stdout.trim() !== introductionBase) {
      throw new Error("Unable to read lifecycle registry from trusted development ref")
    }
    return undefined
  }
  try {
    return JSON.parse(result.stdout) as DebtLifecycleRegistry
  } catch {
    throw new Error("Trusted development lifecycle registry is not valid JSON")
  }
}
