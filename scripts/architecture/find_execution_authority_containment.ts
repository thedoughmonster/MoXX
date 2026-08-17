export type ContainedAuthority = {
  target: string
  recursive: boolean
}

export function findContained(
  allowed: ContainedAuthority[],
  denied: string[],
  separator: "/" | ".",
): string[] {
  const overlaps = allowed.flatMap((authority) =>
    denied.flatMap((prohibition) => {
      if (authority.target === prohibition ||
        authority.target.startsWith(`${prohibition}${separator}`)) {
        return [authority.target]
      }
      if (authority.recursive &&
        prohibition.startsWith(`${authority.target}${separator}`)) {
        return [prohibition]
      }
      return []
    }))
  return [...new Set(overlaps)].sort()
}
