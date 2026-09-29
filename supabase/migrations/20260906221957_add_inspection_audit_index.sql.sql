/*
# Add index for Global-Admin inspection audit queries

## Purpose
The `audit_logs` table already has the columns needed to record Global-Admin
tenant inspection events (`actor_role`, `actor_email`, `action_type`,
`entity_type`, `entity_id`, `new_state`). Inspection logs will use
`action_type = 'INSPECT_TENANT'` with `entity_type = 'tenant'` and the
tenant's company UUID in `entity_id`. The `new_state` JSONB column will hold
`{ accessedView, clientIp, timestamp }`.

## Changes
1. Add a partial index on `audit_logs(action_type)` filtered to
   `INSPECT_TENANT` rows so inspection-history queries are fast without
   bloating the index with every other audit event.

## Security
No new tables. No RLS changes. The existing `audit_logs` RLS policies
remain unchanged — only authenticated users can read, and inserts flow
through the same policy as all other audit entries.
*/

CREATE INDEX IF NOT EXISTS idx_audit_logs_inspection
  ON audit_logs (entity_id, utc_timestamp DESC)
  WHERE action_type = 'INSPECT_TENANT';
