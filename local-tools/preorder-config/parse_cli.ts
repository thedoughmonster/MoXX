import type { CliOptions } from "./types.ts";

const projectRefs = {
  dev: "xtbraqnlskmqxinjxxdn",
  prod: "viodfldzuoypnpqaagag",
} as const;

export function parseCli(args: string[]): CliOptions {
  const values: Record<string, string> = {};
  const valued = new Set(["--env", "--project-ref", "--config", "--actor"]);
  let execute = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--" && index === 0) continue;
    if (token === "--execute") {
      if (execute) throw new Error("Duplicate option: --execute");
      execute = true;
      continue;
    }
    if (token === "--dry-run") continue;
    if (!valued.has(token)) {
      throw new Error(`Unknown or unsafe option: ${token}`);
    }
    if (Object.hasOwn(values, token)) {
      throw new Error(`Duplicate option: ${token}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    values[token] = value;
    index += 1;
  }
  for (const required of valued) {
    if (!values[required]) {
      throw new Error(`Required option missing: ${required}`);
    }
  }
  const environment = values["--env"];
  if (environment !== "dev" && environment !== "prod") {
    throw new Error("--env must be dev or prod");
  }
  if (values["--project-ref"] !== projectRefs[environment]) {
    throw new Error("--project-ref does not match the selected environment");
  }
  return {
    environment,
    projectRef: values["--project-ref"],
    configPath: values["--config"],
    actorRef: values["--actor"],
    execute,
  };
}
