export const retentionSunset = "2026-10-29T00:00:00Z"
export const retentionFunctionSlug = "momi-cron-history-governor-v1"

export const retentionProjects = Object.freeze({
  dev: "xtbraqnlskmqxinjxxdn",
  prod: "viodfldzuoypnpqaagag",
})

export const retentionVersions = Object.freeze({
  dev: Object.freeze(["20261022172534"]),
  prod: Object.freeze(["20260805081324", "20260805122000", "20261022172534"]),
})

// SHA-256 of the exact repository migration source after CRLF-to-LF normalization.
export const retentionMigrations: Readonly<Record<string, Readonly<{
  file: string
  sha256: string
}>>> = Object.freeze({
  "20260805081324": Object.freeze({
    file: "supabase/migrations/20260805081324_govern_cron_history_retention_trigger_adapter.sql",
    sha256: "f6c2f52ba5280ab41eecd8d8defc4bb19b639e057c0d1f1eab9cde4fff6c31f4",
  }),
  "20260805122000": Object.freeze({
    file: "supabase/migrations/20260805122000_derive_cron_history_provider_warning.sql",
    sha256: "a75da65235aca1ef2941f37eeff2df7a37b8f20e956e7c43c1c5d5bb3c1bbf0d",
  }),
  "20261022172534": Object.freeze({
    file: "supabase/migrations/20261022172534_configure_thirty_day_cron_history_retention.sql",
    sha256: "5a9973fb08e38b212ad793e6ad177c87492dfd53268f7567f0ef26ddbc11e296",
  }),
})
