import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { assertInventory } from "./deploy/assert_inventory.ts"
import { linkProject } from "./deploy/link_project.ts"
import { listHostedFunctions } from "./deploy/list_hosted_functions.ts"
import { parseDeploymentOptions } from "./deploy/parse_deployment_options.ts"
import { reconcileInventory } from "./deploy/reconcile_inventory.ts"
import { requireCredentials } from "./deploy/require_credentials.ts"
import { runChecks } from "./deploy/run_checks.ts"
import { selectFunctions } from "./deploy/select_functions.ts"

const options = parseDeploymentOptions()
const architecture = await validateArchitecture()
const functions = selectFunctions(architecture, options.service)
const environment = architecture.workspace.environments[options.environment]
requireCredentials()
runChecks(options.service)
linkProject(environment.project_ref)
const hosted = listHostedFunctions(environment.project_ref)
assertInventory(reconcileInventory(architecture, options.environment, hosted))
console.log(JSON.stringify({
  environment: options.environment,
  project_ref: environment.project_ref,
  service: options.service,
  functions: functions.map((item) => item.slug).sort(),
  order: ["check", "functions", "inventory", "probes", "advisors"],
}, null, 2))
