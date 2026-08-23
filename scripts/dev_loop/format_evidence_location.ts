const excerptLimit = 240
const excerptHalf = 104

export function formatEvidenceLocation(location: string, hash: string): string {
  if (location.length <= excerptLimit) return location
  return `${location.slice(0, excerptHalf)} … ` +
    `${location.slice(-excerptHalf)} [sha256:${hash.slice(0, 12)}]`
}
