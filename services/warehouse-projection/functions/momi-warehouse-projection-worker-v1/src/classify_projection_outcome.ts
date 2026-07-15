import type { ProjectionOutcome } from "./types.ts"

export function classifyProjectionOutcome(
  input: unknown,
): ProjectionOutcome | null {
  if (
    input === "acquisition_enqueued" ||
    input === "acquisition_already_enqueued"
  ) return input
  return typeof input === "string" &&
      /^(projected(?:_[a-z0-9_]+)?|ignored_[a-z0-9_]+)$/.test(input)
    ? input as ProjectionOutcome
    : null
}
