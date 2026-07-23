export function assertMigrationVersionParity(
  localVersions: string[],
  hostedVersions: string[],
): void {
  const local = [...localVersions].sort()
  const hosted = [...hostedVersions].sort()
  if (local.join("\n") === hosted.join("\n")) return
  const missing = local.filter((version) => !hosted.includes(version))
  const extra = hosted.filter((version) => !local.includes(version))
  throw new Error(
    `Migration history differs; missing remote: ${missing.join(", ") || "none"}; ` +
    `extra remote: ${extra.join(", ") || "none"}`,
  )
}
