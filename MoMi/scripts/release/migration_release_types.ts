export type MigrationPushPlan = {
  localFilenames: string[]
  localVersions: string[]
  missingFilenames: string[]
  missingVersions: string[]
  includeAll: boolean
}

export type MigrationReleaseIo = {
  readHosted: () => string
  preview: (includeAll: boolean) => string
  apply: (includeAll: boolean) => void
}
