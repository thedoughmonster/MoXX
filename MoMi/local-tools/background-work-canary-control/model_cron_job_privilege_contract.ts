export type CronJobPrivilegeContractInput = {
  cronJobSelect: boolean
  cronJobUpdate: boolean
  scheduleExecute: boolean
  alterJobExecute: boolean
  unscheduleExecute: boolean
  explicitRowLockClauses: number
  directCronJobDml: boolean
}

export type CronJobPrivilegeContractResult = {
  outcome: string
  metadataPrivileges: string[]
  mutationFunctions: string[]
}

export function modelCronJobPrivilegeContract(
  input: CronJobPrivilegeContractInput,
): CronJobPrivilegeContractResult {
  const contract = {
    metadataPrivileges: ["SELECT"],
    mutationFunctions: ["cron.schedule", "cron.alter_job", "cron.unschedule"],
  }
  if (!input.cronJobSelect) return { outcome: "metadata_select_missing", ...contract }
  if (input.cronJobUpdate) return { outcome: "table_update_privilege_not_intended", ...contract }
  if (input.explicitRowLockClauses !== 0) {
    return { outcome: "tuple_lock_requires_update", ...contract }
  }
  if (input.directCronJobDml) return { outcome: "direct_table_dml_prohibited", ...contract }
  if (!input.scheduleExecute || !input.alterJobExecute || !input.unscheduleExecute) {
    return { outcome: "supported_function_execute_missing", ...contract }
  }
  return { outcome: "select_metadata_supported_functions_accepted", ...contract }
}
