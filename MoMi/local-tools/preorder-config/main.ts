import { canonicalJson } from "./canonical_json.ts";
import { assertReleasedDev } from "./assert_released_dev.ts";
import { confirmExecution } from "./confirm_execution.ts";
import { hashText } from "./hash_text.ts";
import { loadConfig } from "./load_config.ts";
import { parseCli } from "./parse_cli.ts";
import { publishConfig } from "./publish_config.ts";
import { validateConfig } from "./validate_config.ts";
import { writeOperatorReceipt } from "./write_operator_receipt.ts";
import type { OperatorReceipt } from "./types.ts";

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
const release = assertReleasedDev(options.releaseReceiptPath as string);
await confirmExecution(
  `PUBLISH ${options.environment} ${options.projectRef} ${digest}`,
);
const runId = crypto.randomUUID();
const startedAt = new Date().toISOString();
const operatorReceipt: OperatorReceipt = {
  schema_version: 1,
  run_id: runId,
  environment: options.environment,
  project_ref: options.projectRef,
  publication_ref: config.publication_ref,
  publication_mode: config.publication_mode,
  config_sha256: digest,
  release_head_sha: release.headSha,
  release_head_tree: release.headTree,
  started_at: startedAt,
  status: "started",
};
const operatorReceiptPath = await writeOperatorReceipt(operatorReceipt);
try {
  const execution = await publishConfig(
    config,
    digest,
    options.actorRef,
    options.projectRef,
  );
  operatorReceipt.completed_at = new Date().toISOString();
  operatorReceipt.status = "succeeded";
  operatorReceipt.readback = execution.readback;
  await writeOperatorReceipt(operatorReceipt);
  process.stdout.write(`${JSON.stringify({
    receipt: execution.receipt,
    readback: execution.readback,
    operator_receipt: operatorReceiptPath,
  }, null, 2)}\n`);
} catch (error) {
  operatorReceipt.completed_at = new Date().toISOString();
  operatorReceipt.status = "failed";
  await writeOperatorReceipt(operatorReceipt);
  throw error;
}
