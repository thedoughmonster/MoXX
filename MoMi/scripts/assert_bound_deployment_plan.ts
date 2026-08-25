import { readFileSync } from "node:fs"

import { canonicalJson } from "./dev_loop/canonical_json.ts"
import { hashText } from "./dev_loop/hash_text.ts"
import type { BoundPlan } from "./dev_loop/types.ts"
import { readOption } from "./read_option.ts"

const path = readOption("plan", "")
const digest = readOption("digest", "")
const services = readOption("services", "").split(",").filter(Boolean).sort()
const expectedSha = readOption("head", "")
const expectedTree = readOption("tree", "")
const plan = JSON.parse(readFileSync(path, "utf8")) as BoundPlan
if (hashText(canonicalJson(plan)) !== digest) {
  throw new Error("Recomputed deployment plan digest differs")
}
if (plan.head.sha !== expectedSha || plan.head.tree !== expectedTree) {
  throw new Error("Recomputed deployment identity differs")
}
if (plan.impact.release.services.join(",") !== services.join(",")) {
  throw new Error("Affected deployment services differ")
}
if (
  plan.impact.release.functions.length === 0 &&
  plan.impact.release.database === "none" &&
  plan.impact.release.hosted_inventory !== "development_full_parity"
) {
  throw new Error("Deployment plan contains no hosted changes")
}
