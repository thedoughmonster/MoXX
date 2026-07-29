export const functionKey = "momi.preorder.bootstrap.read.v1"

export type BootstrapInput = {
  surface_key: string
  fulfillment_date: string | null
}

export type BootstrapRead = {
  admitted: boolean
  data: Record<string, unknown> | null
}

export type BootstrapReader = (
  input: BootstrapInput,
) => Promise<BootstrapRead>
