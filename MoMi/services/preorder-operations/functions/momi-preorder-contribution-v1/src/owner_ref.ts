import type { OwnerRef } from "./types.ts"

export function ownerRef(
  contractKey: string, id: string, version: number,
): OwnerRef {
  return { owner_service: "preorder-operations", contract_key: contractKey,
    resource_id: id, resource_version: version }
}
