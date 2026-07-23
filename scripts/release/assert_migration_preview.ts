export function assertMigrationPreview(
  expectedFilenames: string[],
  previewedFilenames: string[],
): void {
  if (expectedFilenames.join("\n") === previewedFilenames.join("\n")) return
  const expected = new Set(expectedFilenames)
  const previewed = new Set(previewedFilenames)
  const missing = expectedFilenames.filter((name) => !previewed.has(name))
  const extra = previewedFilenames.filter((name) => !expected.has(name))
  throw new Error(
    `Migration preview differs; missing: ${missing.join(", ") || "none"}; ` +
    `extra: ${extra.join(", ") || "none"}; expected order: ` +
    `${expectedFilenames.join(", ") || "none"}; preview order: ` +
    `${previewedFilenames.join(", ") || "none"}`,
  )
}
