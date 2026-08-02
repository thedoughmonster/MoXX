import type { SetupErrorCategory, SetupStage } from "./setup_preflight_types.ts"

export class SetupPreflightError extends Error {
  readonly category: SetupErrorCategory
  readonly stage: SetupStage
  readonly childExitCode?: number
  readonly sqlstate?: string
  readonly releaseSha?: string
  readonly providerWorkBegan: boolean

  constructor(category: SetupErrorCategory, stage: SetupStage,
    details: { childExitCode?: number, sqlstate?: string, releaseSha?: string,
      providerWorkBegan?: boolean } = {}) {
    super(category)
    this.name = "SetupPreflightError"
    this.category = category
    this.stage = stage
    this.childExitCode = details.childExitCode
    this.sqlstate = details.sqlstate
    this.releaseSha = details.releaseSha
    this.providerWorkBegan = details.providerWorkBegan ?? false
  }
}
