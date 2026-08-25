import { validateArchitecture } from "./architecture/validate_architecture.ts"
import { assertGitHubDeploymentAuthority } from "./deploy/assert_github_deployment_authority.ts"
import { assertGitState } from "./deploy/assert_git_state.ts"
import { assertInventory } from "./deploy/assert_inventory.ts"
import { assertPlanIdentity } from "./deploy/assert_plan_identity.ts"
import { deployFunctions } from "./deploy/deploy_functions.ts"
import { linkProject } from "./deploy/link_project.ts"
import { listHostedFunctions } from "./deploy/list_hosted_functions.ts"
import { parseDeploymentOptions } from "./deploy/parse_deployment_options.ts"
import { probeFunctions } from "./deploy/probe_functions.ts"
import { readAdvisors } from "./deploy/read_advisors.ts"
import { reconcileInventory } from "./deploy/reconcile_inventory.ts"
import { requireCredentials } from "./deploy/require_credentials.ts"
import { selectFunctions } from "./deploy/select_functions.ts"
import { writeReleaseRecord } from "./deploy/write_release_record.ts"

const options = parseDeploymentOptions()
assertGitHubDeploymentAuthority(options.environment)
assertPlanIdentity()
const architecture = await validateArchitecture()
const functions = selectFunctions(architecture, options.services)
const environment = architecture.workspace.environments[options.environment]
const context = {
  environment: options.environment,
  project_ref: environment.project_ref,
  service: options.services.join(","),
  functions,
}
requireCredentials()
assertGitState(environment.branch)
linkProject(environment.project_ref)
deployFunctions(environment.project_ref, functions)
const hosted = listHostedFunctions(environment.project_ref)
const inventory = reconcileInventory(architecture, options.environment, hosted)
assertInventory(inventory)
const probes = await probeFunctions(environment.project_ref, functions)
if (probes.some((probe) => !probe.ok)) throw new Error("A hosted probe failed")
const advisors = await readAdvisors(environment.project_ref)
const record = await writeReleaseRecord(context, inventory, probes, advisors)
console.log(`Release record: ${record}`)
