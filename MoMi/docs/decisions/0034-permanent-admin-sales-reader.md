# 0034: Permanent admin sales reader

Status: accepted scope; implementation under MOX-583.
Date: 2026-09-11.

The user requested one continuing admin connection and explicitly confirmed a
permanent live connection for the private admin. Its first permission is the
previously proposed Berwick sales aggregate reader. Existing gateway admission
does not admit this consumer and must not be reused.

warehouse-read-api remains the read facade and owns the new versioned
momi.admin.sales_health.v1 HTTP contract, admission counters and one-use read
capabilities. Existing warehouse-owned analysis views supply the data. No
business dataset ownership moves and no frontend database login is created.
Future modules must declare their own resource contracts and permissions.

The new scoped server credential is held in the target MoMi and Sites protected
runtime stores, entered directly by Zac. It remains valid until revoked under
MOX-583's active-development scope, rotation and revocation controls. Short-lived
one-use capabilities still authorize each database read. This exception concerns
the scoped admin API credential, never a Supabase PAT, service-role key or
database password. The app credential cannot reach payroll, personal identifiers,
raw records, arbitrary SQL, writes or source APIs.

Removing the existing dynamic entity-view identifier is a prerequisite to new
runtime in this service. Equivalent static view reads preserve its four existing
entity contracts; the corresponding removal-only debt finding is deleted only
after its tests and architecture checks pass.

Production activation follows the existing release procedure and protected
credential placement. Rolling back disables the new consumer and restores the
labeled snapshot configuration; no old temporary feed is revived.

The declared owner role already exists in development but the pooled postgres
login cannot assume it. The manifest now explicitly declares
runtime_set_role_from: postgres for this owner. Its narrowly modeled grant
permits only this owner role, INHERIT FALSE and SET TRUE; SET FALSE is its
additive rollback. Other role recipients, inheritance, admin options, session
changes and ownership transfers remain rejected. This models the required
permission without borrowing another service's role or widening a debt baseline.

Production still has 54 earlier unapplied migrations, including unrelated
Trello and preorder changes. This issue does not authorize their activation.
A production release must establish a separately accepted baseline/rollout
before applying this reader; a passing local test is not a production receipt.

Admin admission objects live in the new, exclusively owned momi_admin_reads
schema. This keeps the schema grant within warehouse-read-api ownership; the
shared momi_api schema's authority is not changed. Aggregate source views remain
in the existing approved momi_analysis contract.
