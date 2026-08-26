import type { EnvironmentKey } from "./types.ts"

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>

export function assertGitHubDeploymentAuthority(
  environment: EnvironmentKey,
  runtime: RuntimeEnvironment = process.env,
): void {
  const expectedRef = `refs/heads/${environment}`
  const expectedWorkflow =
    `thedoughmonster/MoXX/.github/workflows/deploy-${environment}.yml@`
  if (runtime.GITHUB_ACTIONS !== "true") {
    throw new Error("Deployment apply is restricted to GitHub Actions")
  }
  const expectedEvent = "workflow_dispatch"
  if (runtime.GITHUB_EVENT_NAME !== expectedEvent) {
    throw new Error(`Deployment apply requires a GitHub ${expectedEvent} event`)
  }
  if (runtime.GITHUB_REF !== expectedRef) {
    throw new Error(`Deployment apply requires ${expectedRef}`)
  }
  if (!runtime.GITHUB_WORKFLOW_REF?.startsWith(expectedWorkflow)) {
    throw new Error(`Deployment apply requires deploy-${environment}.yml`)
  }
  if (runtime.MOMI_EXPECTED_SHA !== runtime.GITHUB_SHA) {
    throw new Error("Deployment requires the exact approved SHA")
  }
}
