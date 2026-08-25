import type { MigrationPushPlan } from "./migration_release_types.ts"

export function buildMigrationPushPlan(
  localFilenames: string[],
  hostedVersions: string[],
  authorizedVersions: string[],
): MigrationPushPlan {
  const filenames = [...localFilenames].sort()
  const local = filenames.map((filename) => {
    const version = filename.match(/^(\d{14})_[a-z0-9_]+\.sql$/)?.[1]
    if (!version) throw new Error(`${filename}: invalid local migration filename`)
    return version
  })
  const invalidAuthorized = authorizedVersions.find((version) =>
    !/^\d{14}$/.test(version)
  )
  if (invalidAuthorized) {
    throw new Error(`${invalidAuthorized}: invalid authorized migration version`)
  }
  if (new Set(local).size !== local.length) {
    throw new Error("Local migration inventory contains duplicate versions")
  }
  if (new Set(hostedVersions).size !== hostedVersions.length) {
    throw new Error("Hosted migration history contains duplicate versions")
  }
  if (new Set(authorizedVersions).size !== authorizedVersions.length) {
    throw new Error("Migration authorization contains duplicate versions")
  }
  const localSet = new Set(local)
  const hostedSet = new Set(hostedVersions)
  const authorizedSet = new Set(authorizedVersions)
  const unknownHosted = hostedVersions.filter((version) => !localSet.has(version))
  if (unknownHosted.length > 0) {
    throw new Error(
      `Hosted migration history contains unknown local versions: ${unknownHosted.join(", ")}`,
    )
  }
  const missingVersions = local.filter((version) => !hostedSet.has(version))
  const unplanned = missingVersions.filter((version) => !authorizedSet.has(version))
  const unknownAuthorized = authorizedVersions.filter((version) => !localSet.has(version))
  if (unplanned.length > 0 || unknownAuthorized.length > 0) {
    throw new Error(
      `Migration authorization differs; unplanned local missing: ` +
      `${unplanned.join(", ") || "none"}; authorized but not local: ` +
      `${unknownAuthorized.join(", ") || "none"}`,
    )
  }
  const hostedTip = [...hostedVersions].sort().at(-1)
  const includeAll = hostedTip !== undefined &&
    missingVersions.some((version) => version < hostedTip)
  const missingSet = new Set(missingVersions)
  return {
    localFilenames: filenames,
    localVersions: local,
    missingFilenames: filenames.filter((_, index) => missingSet.has(local[index])),
    missingVersions,
    includeAll,
  }
}
