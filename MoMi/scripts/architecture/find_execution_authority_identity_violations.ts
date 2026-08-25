import type { LoadedExecutionAuthority } from
  "./execution_authority_types.ts"

export function findExecutionAuthorityIdentityViolations(
  items: readonly LoadedExecutionAuthority[],
): string[] {
  const violations: string[] = []
  const sorted = [...items].sort((left, right) =>
    left.label.localeCompare(right.label))
  const groups = [
    {
      field: "grant_id",
      value: (item: LoadedExecutionAuthority) => item.grant.grant_id,
      target: (item: LoadedExecutionAuthority) => item.grant.grant_id,
    },
    {
      field: "work_item",
      value: (item: LoadedExecutionAuthority) =>
        `${item.grant.repository}\0${item.grant.work_item}`,
      target: (item: LoadedExecutionAuthority) =>
        `${item.grant.repository}:${item.grant.work_item}`,
    },
  ] as const
  for (const group of groups) {
    const index = new Map<string, LoadedExecutionAuthority[]>()
    for (const item of sorted) {
      const key = group.value(item)
      index.set(key, [...(index.get(key) ?? []), item])
    }
    for (const matches of index.values()) {
      if (matches.length < 2) continue
      for (const item of matches) {
        violations.push(
          `${item.label}/${group.field}: ambiguous_authority: ` +
            group.target(item),
        )
      }
    }
  }
  return violations.sort((left, right) => left.localeCompare(right))
}
