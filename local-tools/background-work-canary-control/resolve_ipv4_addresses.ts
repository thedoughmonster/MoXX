import { lookup } from "node:dns/promises"

export async function resolveIpv4Addresses(hostname: string): Promise<string[]> {
  const answers = await lookup(hostname, { all: true, family: 4, verbatim: true })
  return answers.map((answer) => answer.address)
}
