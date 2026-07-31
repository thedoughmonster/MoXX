import type { AdvisorResult } from "./types.ts"
import { readAdvisor } from "./read_advisor.ts"

export async function readAdvisors(projectRef: string): Promise<AdvisorResult> {
  const [security, performance] = await Promise.all([
    readAdvisor(projectRef, "security"),
    readAdvisor(projectRef, "performance"),
  ])
  return { security, performance }
}
