export function portableRelativePath(value: string): string {
  const relative = value.startsWith("portable/") ? value.slice("portable/".length) : value
  if (relative === "" || relative.includes("\\") || relative.startsWith("/") ||
    relative.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`Unsafe portable export path: ${value}`)
  }
  return relative
}
