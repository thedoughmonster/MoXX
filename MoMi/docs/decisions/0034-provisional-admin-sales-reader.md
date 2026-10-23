# 0034: Provisional admin sales reader

Status: accepted scope; implementation under MOX-583.
Date: 2026-09-11.

The user requested one continuing admin connection, then clarified on
September 11 that its permission is provisional until the official dashboard
goes live. This supersedes the earlier permanent-access wording. Its first
permission is the previously proposed Berwick sales aggregate reader. Existing
gateway admission does not admit this consumer and must not be reused.

warehouse-read-api remains the read facade and owns the new versioned
momi.admin.sales_health.v1 HTTP contract, admission counters and one-use read
capabilities. An indexed warehouse-owned canonical sales view supplies the data. No
business dataset ownership moves and no frontend database login is created.
Future modules must declare their own resource contracts and permissions.

The new scoped server credential is held in the target MoMi and Sites protected
runtime stores, entered directly by Zac. Its authority ends at the official
dashboard production cutover, or earlier revocation. Credential rotation cannot
extend that provisional term or transfer it to the official dashboard. Short-lived
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

Official dashboard go-live requires its own reviewed admission and credential,
followed by disablement of dough-monster-admin and revocation/removal of its
matching MoMi and interim app credentials in every provisioned target. Zac owns
credential revocation; the warehouse-read-api owner disables the consumer via
the approved delivery path. The cutover is incomplete until fresh requests and
outstanding capabilities are verified denied. This is a required cutover step,
not an implemented automatic launch trigger. A preview is not a production
cutover, and shared warehouse data and other consumers remain outside this
revocation. See the contract for the exact cutover checklist.

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
shared momi_api schema's authority is not changed. The aggregate stays in momi_analysis; its source remains behind the warehouse
owner's declared canonical read contract.

The original general-purpose analysis bridge exceeded bounded production reads.
The new warehouse-owned sales_source_entities_v1 view uses the existing entity
type and latest-version indexes, preserving the exact order/location winner
ordering while excluding unrelated entity types before document projection.
The facade joins preaggregated daily buckets/channels rather than rescanning
them for each date. No index, business table, writer, or event lifecycle changes.
A read-only production prototype returned the same 22,868 dated non-voided
orders across 630 observed dates in 1.395 seconds, with a 744,747-byte payload.
September 10 still reconciles to 34 orders / 588.85. This is operator query
evidence, not proof of a deployed endpoint or completed ingestion.
