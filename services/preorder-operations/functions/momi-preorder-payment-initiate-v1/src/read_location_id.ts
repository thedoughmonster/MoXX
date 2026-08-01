export function readLocationId(): string {
  return Deno.env.get("SQUARE_SANDBOX_LOCATION_ID") ?? ""
}
