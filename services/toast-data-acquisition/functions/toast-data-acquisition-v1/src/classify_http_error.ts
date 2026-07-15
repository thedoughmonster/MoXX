export function classifyHttpError(status: number): string | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) return "toast_token_rejected";
  if (status === 429) return "toast_rate_limited";
  if (status >= 500) return "toast_server_error";
  return "toast_http_error";
}
