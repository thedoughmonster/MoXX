export function shouldGenerateCatalog(path: string): boolean {
  return path === "docs/service-catalog.md" ||
    /^services\/[^/]+\/service\.json$/.test(path) ||
    /^services\/[^/]+\/functions\/[^/]+\/function\.json$/.test(path)
}
