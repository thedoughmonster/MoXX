import type { Input } from "./types.ts"

const keyPattern = /^[a-z][a-z0-9_-]{1,63}$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const contractPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*\.v[1-9][0-9]*$/

export async function parseRequest(request: Request): Promise<Input | null> {
  try {
    const value = await request.json() as Partial<Input>
    const timestamp = Date.parse(`${value.fulfillment_date}T00:00:00Z`)
    const selection = value.selection as unknown as Record<string, unknown>
    const referenceKeys = ["campaign_ref", "menu_ref", "product_ref",
      "fulfillment_ref"]
    const validReference = (candidate: unknown) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return false
      }
      const ref = candidate as Record<string, unknown>
      return Object.keys(ref).sort().join(",") ===
          "contract_key,owner_service,resource_id,resource_version" &&
        ref.owner_service === "preorder-operations" &&
        typeof ref.contract_key === "string" && contractPattern.test(ref.contract_key) &&
        typeof ref.resource_id === "string" && uuidPattern.test(ref.resource_id) &&
        Number.isInteger(ref.resource_version) && (ref.resource_version as number) >= 1
    }
    if (Object.keys(value).sort().join(",") !==
        "fulfillment_date,selection,surface_key" ||
      !value.surface_key || !keyPattern.test(value.surface_key) ||
      !value.fulfillment_date || !datePattern.test(value.fulfillment_date) ||
      Number.isNaN(timestamp) || !value.selection ||
      typeof value.selection !== "object" || Array.isArray(value.selection) ||
      Object.keys(selection).sort().join(",") !== ["allergen_evidence",
        "campaign_ref", "disclosures", "eligibility_evidence", "event_ref",
        "fulfillment_evidence", "fulfillment_ref", "menu_ref", "option_refs",
        "pricing", "product_ref", "quantity", "rule_refs", "valid_until"].join(",") ||
      !referenceKeys.every((key) => validReference(selection[key])) ||
      (selection.event_ref !== null && !validReference(selection.event_ref)) ||
      !Array.isArray(selection.option_refs) ||
      !selection.option_refs.every(validReference) ||
      new Set(selection.option_refs.map((ref) =>
        (ref as Record<string, unknown>).resource_id)).size !==
        selection.option_refs.length ||
      !Array.isArray(selection.rule_refs) ||
      !selection.rule_refs.every(validReference) ||
      !Number.isInteger(selection.quantity) || (selection.quantity as number) < 1 ||
      !selection.fulfillment_evidence ||
      typeof selection.fulfillment_evidence !== "object" ||
      !selection.pricing || typeof selection.pricing !== "object" ||
      !selection.allergen_evidence ||
      typeof selection.allergen_evidence !== "object" ||
      !selection.eligibility_evidence ||
      typeof selection.eligibility_evidence !== "object" ||
      !Array.isArray(selection.disclosures) ||
      typeof selection.valid_until !== "string" ||
      Number.isNaN(Date.parse(selection.valid_until))) return null
    return value as Input
  } catch {
    return null
  }
}
