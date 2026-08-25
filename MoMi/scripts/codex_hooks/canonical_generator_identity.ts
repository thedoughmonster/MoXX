import { momiFixes } from "../momi_fix/registrations.ts"
import type {
  CanonicalGenerator,
  CanonicalGeneratorIdentity,
} from "./types.ts"

export function canonicalGeneratorIdentity(
  kind: CanonicalGenerator,
): CanonicalGeneratorIdentity {
  const fix = momiFixes[kind]
  return {
    kind,
    script: fix.script,
    command: `pnpm ${fix.script}`,
    path: fix.outputs[0],
    validation_command: fix.validation_command,
  }
}
