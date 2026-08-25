export type RepositoryRuntimeEvidence = {
  nodeVersion: string
  pnpmVersion: string
  branch: string
  headSha: string
  expectedHeadSha: string
  porcelainStatus: string
  projectRef: string
}

export type RepositoryPreflight = {
  nodeVersion: "24.14.0"
  pnpmVersion: "11.7.0"
  supabaseCliVersion: "2.109.1"
  branch: "dev"
  headSha: string
  projectRef: "xtbraqnlskmqxinjxxdn"
}
