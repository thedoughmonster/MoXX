const allowedOrigins = new Set([
  "https://moxi-web-preorder-preview.thedoughmonster.workers.dev",
  "https://preorder.dough.monster",
]);

export const publicOriginPolicy = {
  isAllowed(request: Request): boolean {
    const origin = request.headers.get("origin");
    return origin === null || allowedOrigins.has(origin);
  },
  responseHeaders(
    request: Request,
    allowedHeaders: string,
    allowedMethods: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Headers": allowedHeaders,
      "Access-Control-Allow-Methods": allowedMethods,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Referrer-Policy": "no-referrer",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
    };
    const origin = request.headers.get("origin");
    if (origin && allowedOrigins.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    return headers;
  },
};
