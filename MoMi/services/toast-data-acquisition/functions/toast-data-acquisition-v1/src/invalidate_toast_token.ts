import { toastTokenCache } from "./token_cache.ts";

export function invalidateToastToken(): void {
  toastTokenCache.key = "";
  toastTokenCache.token_type = "";
  toastTokenCache.access_token = "";
  toastTokenCache.expires_at = 0;
}
