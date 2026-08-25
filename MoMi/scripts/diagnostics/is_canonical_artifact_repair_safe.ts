export function isCanonicalArtifactRepairSafe(error: unknown): boolean {
  if (error instanceof Error && error.message.startsWith("Quality trend report ")) {
    return true
  }
  return Boolean(error && typeof error === "object" && "code" in error &&
    error.code === "ENOENT")
}
