import { sql } from "./database.ts"

export async function readAdminSales(): Promise<unknown | null> {
  const issued = await sql.begin(async transaction => {
    await transaction`set local role svc_warehouse_read_api`
    await transaction`set local statement_timeout = '6s'`
    return transaction<{ token: string | null }[]>`
      select momi_admin_reads.issue_read_capability_v1(
        'dough-monster-admin', 'sales/health'
      )::text as token
    `
  })
  const token = issued[0]?.token
  if (!token) return null
  return sql.begin(async transaction => {
    await transaction`set local role svc_warehouse_read_api`
    await transaction`set local statement_timeout = '6s'`
    const rows = await transaction<{ dataset: unknown | null }[]>`
      select momi_admin_reads.read_sales_health_v1(${token}::uuid) as dataset
    `
    return rows[0]?.dataset ?? null
  })
}
