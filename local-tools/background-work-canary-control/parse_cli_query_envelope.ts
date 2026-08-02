import { decodeCliQueryEnvelope } from "./decode_cli_query_envelope.ts"

export function parseCliQueryEnvelope(
  output: Uint8Array,
  expectedMarker: string,
): unknown {
  return decodeCliQueryEnvelope(output, expectedMarker).sample
}
