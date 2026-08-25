import { buildChildEnvironment } from "./build_child_environment.ts"

export function buildSafeChildEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment = buildChildEnvironment(source)
  for (const value of Object.values(environment)) {
    if (typeof value !== "string" || value.includes("\0") ||
      Buffer.byteLength(value, "utf8") > 8192) {
      throw new Error("Minimal child environment is invalid")
    }
  }
  return environment
}
