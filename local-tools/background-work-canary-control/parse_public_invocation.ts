import { assertDevelopmentScope } from "./assert_development_scope.ts"
import { parseCli } from "./parse_cli.ts"
import type { CliOptions } from "./types.ts"

export function parsePublicInvocation(args: string[]): CliOptions {
  return assertDevelopmentScope(parseCli(args))
}
