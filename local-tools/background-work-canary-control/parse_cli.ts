import type { RawCliOptions } from "./types.ts"

const valuedOptions = new Set(["--env", "--project-ref"])

export function parseCli(args: string[]): RawCliOptions {
  const values: Record<string, string> = {}
  let index = args[0] === "--" ? 1 : 0

  while (index < args.length) {
    const option = args[index]
    if (!valuedOptions.has(option)) {
      throw new Error(`Unknown or unsafe option: ${option}`)
    }
    if (Object.hasOwn(values, option)) {
      throw new Error(`Duplicate option: ${option}`)
    }
    const value = args[index + 1]
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${option}`)
    }
    values[option] = value
    index += 2
  }

  for (const required of valuedOptions) {
    if (!values[required]) {
      throw new Error(`Required option missing: ${required}`)
    }
  }

  return {
    environment: values["--env"],
    projectRef: values["--project-ref"],
  }
}
