export function parseRetirementSelection(value: string): string[] {
  const slugs = value.split(",").map((slug) => slug.trim()).filter(Boolean).sort()
  if (slugs.some((slug) => !/^[a-z][a-z0-9-]+$/.test(slug))) {
    throw new Error("--retire-functions requires a comma-separated function list")
  }
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("--retire-functions cannot contain duplicates")
  }
  return slugs
}
