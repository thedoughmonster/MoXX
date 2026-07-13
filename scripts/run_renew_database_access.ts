import { loadWorkspace } from "./architecture/load_workspace.ts"
import { buildJitRenewal } from "./database_access/build_jit_renewal.ts"
import type { JitAccessResponse } from "./database_access/types.ts"

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
if (!token) {
  throw new Error("SUPABASE_ACCESS_TOKEN is required")
}

const workspace = await loadWorkspace()
const projectRef = workspace.environments.prod.project_ref
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/jit`
const headers = { Authorization: `Bearer ${token}` }
const currentResponse = await fetch(endpoint, { headers })
if (!currentResponse.ok) {
  throw new Error(`Unable to read JIT access: ${currentResponse.status}`)
}

const current = await currentResponse.json() as JitAccessResponse
const renewal = buildJitRenewal(current)
const updateResponse = await fetch(endpoint, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify(renewal.payload),
})
if (!updateResponse.ok) {
  throw new Error(`Unable to renew JIT access: ${updateResponse.status}`)
}

const updated = await updateResponse.json() as JitAccessResponse
const postgres = updated.user_roles.find((role) => role.role === "postgres")
if (postgres?.expires_at !== renewal.expires_at) {
  throw new Error("Supabase returned an unexpected JIT access expiry")
}

console.log(JSON.stringify({
  project_ref: projectRef,
  role: postgres.role,
  expires_at: new Date(renewal.expires_at * 1000).toISOString(),
}, null, 2))
