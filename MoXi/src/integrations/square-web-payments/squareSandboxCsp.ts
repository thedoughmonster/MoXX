const directives = [
  "default-src 'self'",
  "script-src 'self' https://sandbox.web.squarecdn.com",
  "frame-src 'self' https://sandbox.web.squarecdn.com",
  "connect-src 'self' https://xtbraqnlskmqxinjxxdn.supabase.co https://sandbox.web.squarecdn.com https://pci-connect.squareupsandbox.com https://o160250.ingest.sentry.io",
  "style-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com",
  "font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
] as const;

export function squareSandboxCspContent(): string {
  return directives.join('; ') + ';';
}
