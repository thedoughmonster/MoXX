import type { EnvironmentKey } from "../deploy/types.ts"

export function releaseRequiresMigrations(
  environment: EnvironmentKey,
  branch: string,
  migrationDiffStatus: number,
): boolean {
  if (migrationDiffStatus !== 0 && migrationDiffStatus !== 1) {
    throw new Error("Unable to determine the release migration diff")
  }
  return environment === "prod" || branch === "dev" || migrationDiffStatus === 1
}
