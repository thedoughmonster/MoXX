import { assertMigrationPreview } from "./assert_migration_preview.ts"
import { assertMigrationVersionParity } from "./assert_migration_version_parity.ts"
import { buildMigrationPushPlan } from "./build_migration_push_plan.ts"
import type {
  MigrationPushPlan,
  MigrationReleaseIo,
} from "./migration_release_types.ts"
import { parseMigrationPreview } from "./parse_migration_preview.ts"
import { parseMigrationQuery } from "./parse_migration_query.ts"

export function executeMigrationRelease(
  localFilenames: string[],
  authorizedVersions: string[],
  io: MigrationReleaseIo,
): MigrationPushPlan {
  const hostedBefore = parseMigrationQuery(io.readHosted())
  const plan = buildMigrationPushPlan(
    localFilenames,
    hostedBefore,
    authorizedVersions,
  )
  const previewed = parseMigrationPreview(io.preview(plan.includeAll))
  assertMigrationPreview(plan.missingFilenames, previewed)
  io.apply(plan.includeAll)
  const hostedAfter = parseMigrationQuery(io.readHosted())
  assertMigrationVersionParity(plan.localVersions, hostedAfter)
  return plan
}
