import { canonicalJson } from "./canonical_json.ts";
import { confirmExecution } from "./confirm_execution.ts";
import { hashText } from "./hash_text.ts";
import { loadConfig } from "./load_config.ts";
import { parseCli } from "./parse_cli.ts";
import { publishConfig } from "./publish_config.ts";
import { validateConfig } from "./validate_config.ts";

const options = parseCli(process.argv.slice(2));
const config = await validateConfig(await loadConfig(options.configPath));
const digest = hashText(canonicalJson(config));
const summary = {
  environment: options.environment,
  project_ref: options.projectRef,
  surface_key: config.surface.surface_key,
  mode: config.publication_mode,
  catalog_items: config.catalog.length,
  available_items: config.catalog.filter((item) => item.available).length,
  config_sha256: digest,
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (!options.execute) process.exit(0);
await confirmExecution(
  `PUBLISH ${options.environment} ${options.projectRef} ${digest}`,
);
const receipt = await publishConfig(
  config,
  digest,
  options.actorRef,
  options.projectRef,
);
process.stdout.write(`${JSON.stringify({ receipt }, null, 2)}\n`);
