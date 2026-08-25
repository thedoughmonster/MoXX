export const CANONICAL_FLOCK_PATH = "/usr/bin/flock" as const
export const FLOCK_SELF_TEST_HOLDER_SCRIPT = [
  "process.stdin.resume();",
  "process.stdin.once('end',()=>{",
  "process.stdout.write('RELEASED\\n',()=>process.exit(0));",
  "});",
  "process.stdout.write('LOCKED\\n');",
].join("")
export const LINKED_REF_FILE = "supabase/.temp/project-ref" as const
export const POOLER_URL_FILE = "supabase/.temp/pooler-url" as const
export const SETUP_RECEIPT_CURRENT = "setup-current.json" as const
export const SETUP_RECEIPT_SCHEMA = 1 as const
export const SETUP_RECEIPT_TTL_MS = 15 * 60 * 1000
export const SETUP_STAGE_ORDER = [
  "repository", "flock", "link", "linkage", "receipt",
] as const
