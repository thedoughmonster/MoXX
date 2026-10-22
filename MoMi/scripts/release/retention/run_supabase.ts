import { runSupabase } from "../../deploy/run_supabase.ts"

export function runRetentionSupabase(
  args: string[], capture: true, command: typeof runSupabase = runSupabase,
): string {
  if (capture !== true || !((args[0] === "db" && args[1] === "query") ||
      (args[0] === "functions" && args[1] === "list"))) {
    throw new Error("Unsupported retention CLI operation")
  }
  return command(args, true)
}
