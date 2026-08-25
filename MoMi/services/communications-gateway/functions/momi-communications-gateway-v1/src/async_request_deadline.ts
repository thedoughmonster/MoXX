export function asyncRequestDeadline(asyncDeadline: string): string {
  return new Date(Math.min(Date.parse(asyncDeadline), Date.now() + 120_000)).toISOString()
}
