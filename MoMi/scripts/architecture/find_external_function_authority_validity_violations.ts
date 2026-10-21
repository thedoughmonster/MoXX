import type { ExternalFunctionAuthority } from
  "./external_function_authority_types.ts"

export function findExternalFunctionAuthorityValidityViolations(
  authorities: ExternalFunctionAuthority[],
  today = new Date().toISOString().slice(0, 10),
): string[] {
  const violations: string[] = []
  for (const authority of authorities) {
    const label = authority.function_slug
    const dates = [
      ["verified_at", authority.verified_at],
      ["valid_until", authority.valid_until],
    ]
    if (authority.lifecycle_status === "retired_retained") {
      dates.push(["retirement.verified_at", authority.retirement.verified_at])
      if (authority.retirement.verified_at > authority.verified_at) {
        violations.push(`${label}: retirement verification cannot follow authority verification`)
      }
      const expected = `https://github.com/${authority.owner_repository}/actions/runs/`
      const evidence = authority.retirement.evidence_url
      if (!evidence.startsWith(expected) ||
        !/^[1-9][0-9]*$/.test(evidence.slice(expected.length))) {
        violations.push(`${label}: retirement evidence must identify an owner workflow run`)
      }
    }
    for (const [name, value] of dates) {
      const parsed = new Date(`${value}T00:00:00.000Z`)
      if (Number.isNaN(parsed.valueOf()) ||
        parsed.toISOString().slice(0, 10) !== value) {
        violations.push(`${label}: ${name} must be a valid calendar date`)
      }
    }
    if (authority.verified_at > today) {
      violations.push(`${label}: verified_at cannot be in the future`)
    }
    if (authority.valid_until < authority.verified_at) {
      violations.push(`${label}: valid_until cannot precede verified_at`)
    } else if (authority.valid_until < today) {
      violations.push(`${label}: external authority expired ${authority.valid_until}`)
    }
  }
  return violations.sort()
}
