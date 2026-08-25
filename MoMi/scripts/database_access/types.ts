export type JitRole = {
  role: string
  expires_at?: number
  branches_only?: boolean
  allowed_networks?: {
    allowed_cidrs?: Array<{ cidr: string }>
    allowed_cidrs_v6?: Array<{ cidr: string }>
  }
}

export type JitAccessResponse = {
  user_id: string
  user_roles: JitRole[]
}

export type JitRenewal = {
  expires_at: number
  payload: {
    user_id: string
    roles: JitRole[]
  }
}
