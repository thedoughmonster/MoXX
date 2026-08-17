export function findContained(
  allowed: string[],
  denied: string[],
  separator: "/" | ".",
): string[] {
  return allowed.filter((target) => denied.some((prohibition) =>
    target === prohibition || target.startsWith(`${prohibition}${separator}`)))
}
