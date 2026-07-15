export function validateArchivePath(file: string, prefix: string): void {
  if (!file || file.includes("\\") || file.startsWith("/") || file.endsWith("/")) {
    throw new Error("Archive file path is not a canonical relative path")
  }
  const parts = file.split("/")
  if (parts[0] !== prefix || parts.length < 2) {
    throw new Error(`Archive file path must be below ${prefix}/`)
  }
  for (const part of parts) {
    const base = part.split(".", 1)[0]
    if (!part || part === "." || part === ".." || /[\x00-\x1f<>:"|?*]/.test(part) ||
      part.endsWith(".") || part.endsWith(" ") ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) {
      throw new Error("Archive file path contains an unsafe Windows segment")
    }
  }
}
