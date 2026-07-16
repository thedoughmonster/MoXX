export function buildCliEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {}
  for (const key of [
    "SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "PATHEXT", "COMSPEC",
    "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "SUPABASE_ACCESS_TOKEN",
  ]) if (source[key]) environment[key] = source[key]
  environment.SUPABASE_TELEMETRY_DISABLED = "1"
  return environment
}
