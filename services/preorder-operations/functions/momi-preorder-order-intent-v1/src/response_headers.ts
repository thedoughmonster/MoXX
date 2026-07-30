export function responseHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-momi-checkout-authority",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}
