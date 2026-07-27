export type PipelineSelection = {
  label: string
  pipelineId: string
}

export function selectPipeline(
  labels: readonly string[],
  pipelineMap: Readonly<Record<string, string>>,
): PipelineSelection | null {
  const unknown = labels.filter((label) =>
    label.startsWith("status:") && !Object.hasOwn(pipelineMap, label)
  )
  if (unknown.length) {
    throw new Error(`Unknown status labels found: ${unknown.join(", ")}`)
  }
  const matches = labels.filter((label) => Object.hasOwn(pipelineMap, label))
  if (matches.length > 1) {
    throw new Error(`Multiple managed status labels found: ${matches.join(", ")}`)
  }
  if (matches.length === 0) return null
  const label = matches[0]
  return { label, pipelineId: pipelineMap[label] }
}
