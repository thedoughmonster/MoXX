import type { RetentionEnvironment } from "./types.ts"

export function assertRetentionAuthority(
  environment: RetentionEnvironment,
  runtime: NodeJS.ProcessEnv = process.env,
): void {
  const workflow = `thedoughmonster/MoXX/.github/workflows/deploy-${environment}.yml@refs/heads/dev`
  if (runtime.GITHUB_ACTIONS !== "true" || runtime.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      runtime.GITHUB_REPOSITORY !== "thedoughmonster/MoXX" ||
      runtime.GITHUB_REF !== "refs/heads/dev" || runtime.GITHUB_WORKFLOW_REF !== workflow ||
      !/^[a-f0-9]{40}$/.test(runtime.GITHUB_SHA ?? "") ||
      runtime.MOMI_EXPECTED_SHA !== runtime.GITHUB_SHA) {
    throw new Error("Retention exception requires the exact protected GitHub workflow and dev SHA")
  }
}
