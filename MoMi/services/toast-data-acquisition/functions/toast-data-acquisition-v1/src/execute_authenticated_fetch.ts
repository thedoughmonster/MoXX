import type {
  AuthenticatedFetch,
  AuthRetryDependencies,
  TokenConfig,
} from "./runtime_types.ts";

export async function executeAuthenticatedFetch(
  config: TokenConfig,
  dependencies: AuthRetryDependencies,
): Promise<AuthenticatedFetch> {
  let token = await dependencies.get_token(config);
  if (!token.ok) {
    return { kind: "auth_error", status: token.status, error: token.error };
  }
  let result = await dependencies.perform(token.token_type, token.access_token);
  if (result.kind === "network_error") return result;
  if (result.page.status !== 401) return result;
  dependencies.invalidate_token();
  token = await dependencies.get_token(config);
  if (!token.ok) {
    return { kind: "auth_error", status: token.status, error: token.error };
  }
  result = await dependencies.perform(token.token_type, token.access_token);
  return result;
}
