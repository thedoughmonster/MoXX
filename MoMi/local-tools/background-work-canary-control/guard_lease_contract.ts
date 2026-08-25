export type DatabaseGuardLeaseContract = Readonly<{
  lifecycleFence: "exact_guard_generation_and_database_expiry"
  mutationLock: "transaction_scoped_advisory_lock"
  persistentSessionLock: false
  activationAllowed: false
  activationPrerequisite:
    "issue_330_activation_inside_exact_current_guard_fence_and_orchestration"
}>

export const DATABASE_GUARD_LEASE_CONTRACT: DatabaseGuardLeaseContract = {
  lifecycleFence: "exact_guard_generation_and_database_expiry",
  mutationLock: "transaction_scoped_advisory_lock",
  persistentSessionLock: false,
  activationAllowed: false,
  activationPrerequisite:
    "issue_330_activation_inside_exact_current_guard_fence_and_orchestration",
}
