process.stdout.write(JSON.stringify({
  args: process.argv.slice(2),
  profile: process.env.SUPABASE_PROFILE,
  telemetry: process.env.SUPABASE_TELEMETRY_DISABLED,
  hasReleasePassword: Boolean(process.env.SUPABASE_DB_PASSWORD),
  hasPostgresPassword: Boolean(process.env.PGPASSWORD),
}))
