import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { applyMigrations } from "./deploy/apply_migrations.ts"
import { assertGitState } from "./deploy/assert_git_state.ts"
import { assertInventory } from "./deploy/assert_inventory.ts"
import { deployFunctions } from "./deploy/deploy_functions.ts"
import { linkProject } from "./deploy/link_project.ts"
import { listHostedFunctions } from "./deploy/list_hosted_functions.ts"
import { parseDeploymentOptions } from "./deploy/parse_deployment_options.ts"
import { planMigrations } from "./deploy/plan_migrations.ts"
import { probeFunctions } from "./deploy/probe_functions.ts"
import { readAdvisors } from "./deploy/read_advisors.ts"
import { reconcileInventory } from "./deploy/reconcile_inventory.ts"
import { requireCredentials } from "./deploy/require_credentials.ts"
import { runChecks } from "./deploy/run_checks.ts"
import { selectFunctions } from "./deploy/select_functions.ts"
import { writeReleaseRecord } from "./deploy/write_release_record.ts"

const options = parseDeploymentOptions()
const architecture = await validateArchitecture()
const functions = selectFunctions(architecture, options.service)
const environment = architecture.workspace.environments[options.environment]
const context = {
  environment: options.environment,
  project_ref: environment.project_ref,
  service: options.service,
  functions,
}
requireCredentials(true)
assertGitState(environment.branch)
runChecks(options.service)
linkProject(environment.project_ref)
planMigrations()
applyMigrations()
deployFunctions(environment.project_ref, functions)
const hosted = listHostedFunctions(environment.project_ref)
const inventory = reconcileInventory(architecture, options.environment, hosted)
assertInventory(inventory)
const probes = await probeFunctions(environment.project_ref, functions)
if (probes.some((probe) => !probe.ok)) throw new Error("A hosted probe failed")
const advisors = await readAdvisors(environment.project_ref)
const record = await writeReleaseRecord(context, inventory, probes, advisors)
console.log(`Release record: ${record}`)
