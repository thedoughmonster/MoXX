export const SQL_ARTIFACT_DIRECTORY =
  "local-tools/background-work-canary-control/sql" as const
export const FAST_SQL_FILENAME = "preflight_fast_sample.sql" as const
export const RESOURCE_SQL_FILENAME = "resource_sample.sql" as const
export const FAST_SQL_MARKER = "momi.background-work-canary.fast" as const
export const RESOURCE_SQL_MARKER = "momi.background-work-canary.resource" as const
export const SQL_SCHEMA_VERSION = 1 as const

export const SQL_ARTIFACT_SHA256 = {
  fast: "12e098e576b934d0c44da6ecba05d1f79c78b39e02d6c8abe75b48a5f778483d",
  resource: "417962bf51b24e3f04e7b6f3103a250336fe718844667cb13e86bfeec15cc7a1",
} as const
