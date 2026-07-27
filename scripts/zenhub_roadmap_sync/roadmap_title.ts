import type { RoadmapEntry } from "./types.ts"

export function roadmapTitle(entry: RoadmapEntry): string {
  return `${entry.order} · ${entry.title}`
}
