import { spawnSync } from "node:child_process"

class GitProductLayout {
  readonly repositoryRoot: string
  readonly productPrefix: string

  constructor() {
    this.repositoryRoot = this.git(["rev-parse", "--show-toplevel"])
    this.productPrefix = this.git(["rev-parse", "--show-prefix"])
  }

  git(args: string[]): string {
    const result = spawnSync("git", args, { encoding: "utf8" })
    if (result.status !== 0) {
      throw result.error ?? new Error(String(result.stderr || "git failed"))
    }
    return result.stdout.trim()
  }

  productPathAtRef(ref: string, path: string): string {
    const candidate = `${this.productPrefix}${path}`
    if (!this.productPrefix) return path
    const exists = spawnSync("git", ["cat-file", "-e", `${ref}:${candidate}`], {
      encoding: "utf8",
    })
    if (exists.status === 0) return candidate
    return path
  }

  stripProductPrefix(path: string): string {
    return this.productPrefix && path.startsWith(this.productPrefix)
      ? path.slice(this.productPrefix.length)
      : path
  }

  productSourceCommit(ref: string): string {
    const commit = this.git(["rev-parse", "--verify", `${ref}^{commit}`])
    if (!this.productPrefix) return commit
    const directWorkspace = spawnSync(
      "git", ["cat-file", "-e", `${commit}:workspace.json`],
      { encoding: "utf8" },
    )
    if (directWorkspace.status === 0) return commit
    const productRoot = this.productPrefix.replace(/\/$/, "")
    const tree = this.git(["rev-parse", `${commit}:${productRoot}`])
    const rows = this.git(["log", "--all", "--format=%H%x09%T"]).split("\n")
    for (const row of rows) {
      const [candidate, candidateTree] = row.split("\t")
      if (candidateTree !== tree) continue
      const workspace = spawnSync(
        "git", ["cat-file", "-e", `${candidate}:workspace.json`],
        { encoding: "utf8" },
      )
      if (workspace.status === 0) return candidate
    }
    throw new Error(`Unable to resolve the imported product source for ${ref}`)
  }
}

const layout = new GitProductLayout()
export const gitRepositoryRoot = layout.repositoryRoot
export const gitProductPrefix = layout.productPrefix
export const productPathAtRef = layout.productPathAtRef.bind(layout)
export const stripProductPrefix = layout.stripProductPrefix.bind(layout)
export const productSourceCommit = layout.productSourceCommit.bind(layout)
