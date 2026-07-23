export function releaseRequiresMigrations(
  environment: "dev" | "prod",
  branch: string,
  migrationDiffStatus: number,
): boolean {
  if (migrationDiffStatus !== 0 && migrationDiffStatus !== 1) {
    throw new Error("Unable to determine the release migration diff")
  }
  return migrationDiffStatus === 1 ||
    (environment === "dev" && branch === "dev")
}
