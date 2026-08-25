export function currentQuarter(now = new Date()): string {
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1
  return `${now.getUTCFullYear()}-Q${quarter}`
}
