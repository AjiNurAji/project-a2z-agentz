-- ============================================================================
-- A2Z Agentz - Schema Patch: widen status CHECK constraints
-- Idempotent migration. Safe to run on a live DB; safe to re-run.
--
-- Changes:
--   target_addresses.status: add 'BLACKLISTED' (in addition to 'blacklisted')
--   execution_logs.status:   add 'SUCCESS', 'PENDING_APPROVAL',
--                            'FAILED', 'REJECTED_BLACKLIST'
--                            (case-preserved alongside the legacy values
--                            so any in-flight row keeps passing the check)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Drop ALL existing CHECK constraints that mention the `status` column,
--    regardless of auto-generated name. Defensive against any naming scheme.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conrelid::regclass::text AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'c'
          AND conrelid IN ('target_addresses'::regclass, 'execution_logs'::regclass)
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Re-add with widened allow-lists.
-- ----------------------------------------------------------------------------

-- target_addresses.status
ALTER TABLE target_addresses
    ADD CONSTRAINT target_addresses_status_check
    CHECK (
        status IN (
            'pending',
            'active',
            'paused',
            'blacklisted',
            'BLACKLISTED'
        )
    );

-- execution_logs.status
ALTER TABLE execution_logs
    ADD CONSTRAINT execution_logs_status_check
    CHECK (
        status IN (
            -- legacy / lowercase
            'submitted',
            'pending',
            'pending_approval',
            'confirmed',
            'reverted',
            'failed',
            'rejected_blacklist',
            -- new canonical (uppercase) — used by agent_b.py
            'SUCCESS',
            'PENDING_APPROVAL',
            'FAILED',
            'REJECTED_BLACKLIST'
        )
    );

-- ----------------------------------------------------------------------------
-- 3. Backfill safety: normalize any existing lowercase 'blacklisted' /
--    'pending_approval' / 'rejected_blacklist' rows so future queries using
--    uppercase filters behave consistently. No-op if nothing matches.
-- ----------------------------------------------------------------------------
UPDATE target_addresses
   SET status = 'BLACKLISTED'
 WHERE status = 'blacklisted';

UPDATE execution_logs
   SET status = 'PENDING_APPROVAL'
 WHERE status = 'pending_approval';

UPDATE execution_logs
   SET status = 'REJECTED_BLACKLIST'
 WHERE status = 'rejected_blacklist';

COMMIT;

-- ============================================================================
-- End of patch
-- ============================================================================