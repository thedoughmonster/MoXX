import type { EnvironmentKey } from "./types.ts"

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>

export function assertGitHubDeploymentAuthority(
  environment: EnvironmentKey,
  runtime: RuntimeEnvironment = process.env,
): void {
  const expectedRef = `refs/heads/${environment}`
  const expectedWorkflow = `/.github/workflows/deploy-${environment}.yml@`
  if (runtime.GITHUB_ACTIONS !== "true") {
    throw new Error("Deployment apply is restricted to GitHub Actions")
  }
  if (runtime.GITHUB_EVENT_NAME !== "push") {
    throw new Error("Deployment apply requires a GitHub push event")
  }
  if (runtime.GITHUB_REF !== expectedRef) {
    throw new Error(`Deployment apply requires ${expectedRef}`)
  }
  if (!runtime.GITHUB_WORKFLOW_REF?.includes(expectedWorkflow)) {
    throw new Error(`Deployment apply requires deploy-${environment}.yml`)
  }
}
