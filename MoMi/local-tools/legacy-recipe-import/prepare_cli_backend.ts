import { assertLinkedDev } from "./assert_linked_dev.ts"
import { buildSupabaseLinkArgs } from "./build_supabase_link_args.ts"
import { runSupabaseCli } from "./run_supabase_cli.ts"

export async function prepareCliBackend(
  workspaceRoot: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  await runSupabaseCli(
    buildSupabaseLinkArgs(workspaceRoot), workspaceRoot, environment,
  )
  await assertLinkedDev(workspaceRoot)
}
