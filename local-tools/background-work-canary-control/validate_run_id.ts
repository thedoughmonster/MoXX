export function validateRunId(runId: string): void {
  if (!/^[a-z0-9][a-z0-9-]{7,63}$/.test(runId)) {
    throw new Error("Run ID must be 8-64 lowercase letters, digits, or hyphens")
  }
}
