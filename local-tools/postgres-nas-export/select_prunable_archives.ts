import type { ArchiveSummary } from "./types.ts"

export function selectPrunableArchives(archives: ArchiveSummary[]): ArchiveSummary[] {
  const groups = new Map<string, ArchiveSummary[]>()
  const keep = new Set<string>()
  for (const archive of archives) {
    const key = `${archive.environment}:${archive.projectRef}`
    const group = groups.get(key) ?? []
    group.push(archive)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    group.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const days = new Set<string>()
    const months = new Set<string>()
    const years = new Set<string>()
    for (const archive of group) {
      const day = archive.createdAt.slice(0, 10)
      if (!days.has(day) && days.size < 30) {
        days.add(day)
        keep.add(archive.archiveId)
      }
      const month = archive.createdAt.slice(0, 7)
      if (!months.has(month) && months.size < 12) {
        months.add(month)
        keep.add(archive.archiveId)
      }
      const year = archive.createdAt.slice(0, 4)
      if (!years.has(year)) {
        years.add(year)
        keep.add(archive.archiveId)
      }
    }
  }
  return archives.filter((archive) => !keep.has(archive.archiveId))
}
