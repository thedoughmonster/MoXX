import { createInterface } from "node:readline/promises"

export async function confirmExecution(phrase: string): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Execution requires an interactive terminal for exact confirmation")
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await prompt.question(`Type exactly to continue:\n${phrase}\n> `)
    if (answer !== phrase) throw new Error("Confirmation did not match; nothing was executed")
  } finally {
    prompt.close()
  }
}
