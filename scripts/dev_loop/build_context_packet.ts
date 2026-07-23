import { buildBoundPlan } from "./build_bound_plan.ts"
import { collectApplicableFiles } from "./collect_applicable_files.ts"
import { hashFiles } from "./hash_files.ts"

export async function buildContextPacket(
  issueNumber: number,
  issueTitle: string,
  baseRef: string,
  headRef: string,
): Promise<unknown> {
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    throw new Error("Issue number must be positive")
  }
  const plan = await buildBoundPlan(baseRef, headRef)
  const applicable = collectApplicableFiles(plan)
  return {
    schema_version: 1,
    owning_issue: { number: issueNumber, title: issueTitle },
    execution: {
      transcript: "fresh",
      child_agents: "forbidden",
      model_tier: "normal_primary",
      return_on: ["complete", "material_stop"],
    },
    base: plan.base,
    head: plan.head,
    changed_paths: plan.changed_paths,
    checks: plan.impact,
    rules: hashFiles(applicable.rules),
    contracts: hashFiles(applicable.contracts),
    decisions: {
      continue: plan.materiality.continue,
      stop: plan.materiality.stop,
    },
    stops: plan.materiality.stop,
    hashes: {
      diff_sha256: plan.diff_sha256,
      impact_sha256: plan.impact_sha256,
      base_tree: plan.base.tree,
      head_tree: plan.head.tree,
    },
  }
}
