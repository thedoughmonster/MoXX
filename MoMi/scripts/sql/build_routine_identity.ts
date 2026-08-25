import { canonicalizeRoutineArgument } from
  "./canonicalize_routine_argument.ts"
import { extractRoutineArguments } from "./extract_routine_arguments.ts"

export function buildRoutineIdentity(
  source: string,
  name: string,
  file: string,
): string {
  const arguments_ = extractRoutineArguments(source, name, file)
    .map((argument) => canonicalizeRoutineArgument(argument, file))
    .filter((argument): argument is string => argument !== undefined)
  return `${name.toLowerCase()}(${arguments_.join(",")})`
}
