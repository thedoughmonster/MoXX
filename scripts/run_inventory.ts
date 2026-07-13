import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { assertInventory } from "./deploy/assert_inventory.ts"
import { listHostedFunctions } from "./deploy/list_hosted_functions.ts"
import { parseDeploymentOptions } from "./deploy/parse_deployment_options.ts"
import { reconcileInventory } from "./deploy/reconcile_inventory.ts"
import { requireCredentials } from "./deploy/require_credentials.ts"

const options = parseDeploymentOptions()
const architecture = await validateArchitecture()
requireCredentials(false)
const projectRef = architecture.workspace.environments[options.environment].project_ref
const hosted = listHostedFunctions(projectRef)
assertInventory(reconcileInventory(architecture, options.environment, hosted))
