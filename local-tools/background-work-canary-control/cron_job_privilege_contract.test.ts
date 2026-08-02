import assert from "node:assert/strict"
import { test } from "node:test"
import { modelCronJobPrivilegeContract } from "./model_cron_job_privilege_contract.ts"

const base = {
  cronJobSelect: true,
  cronJobUpdate: false,
  scheduleExecute: true,
  alterJobExecute: true,
  unscheduleExecute: true,
  explicitRowLockClauses: 0,
  directCronJobDml: false,
}

test("SELECT-only cron.job metadata plus supported function EXECUTE is accepted", () => {
  assert.deepEqual(modelCronJobPrivilegeContract(base), {
    outcome: "select_metadata_supported_functions_accepted",
    metadataPrivileges: ["SELECT"],
    mutationFunctions: ["cron.schedule", "cron.alter_job", "cron.unschedule"],
  })
})

test("tuple locks, direct DML, broadened grants, and missing EXECUTE are rejected", () => {
  const cases = [
    [{ cronJobSelect: false }, "metadata_select_missing"],
    [{ cronJobUpdate: true }, "table_update_privilege_not_intended"],
    [{ explicitRowLockClauses: 1 }, "tuple_lock_requires_update"],
    [{ directCronJobDml: true }, "direct_table_dml_prohibited"],
    [{ scheduleExecute: false }, "supported_function_execute_missing"],
    [{ alterJobExecute: false }, "supported_function_execute_missing"],
    [{ unscheduleExecute: false }, "supported_function_execute_missing"],
  ] as const
  for (const [change, outcome] of cases) {
    assert.equal(modelCronJobPrivilegeContract({ ...base, ...change }).outcome, outcome)
  }
})
