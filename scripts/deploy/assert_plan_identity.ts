import { execFileSync } from "node:child_process"

export function assertPlanIdentity(
  runtime: NodeJS.ProcessEnv = process.env,
): void {
  if (!/^[0-9a-f]{64}$/.test(runtime.MOMI_PLAN_SHA256 ?? "")) {
    throw new Error("Deployment requires an exact release plan digest")
  }
  if (!/^[0-9a-f]{40}$/.test(runtime.MOMI_VALIDATED_TREE ?? "")) {
    throw new Error("Deployment requires an exact validated tree")
  }
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
    encoding: "utf8",
  }).trim()
  if (tree !== runtime.MOMI_VALIDATED_TREE) {
    throw new Error("Deployment tree differs from the validated release plan")
  }
}
