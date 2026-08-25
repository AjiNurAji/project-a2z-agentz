-- ============================================================================
-- A2Z Agentz - Schema Patch: Dual-Home Network Segregation
-- Idempotent migration. Safe to run on a live DB; safe to re-run.
--
-- Adds a `network` discriminator column (DEFAULT 'base') to the tables that
-- store on-chain execution state, so Base mainnet and Base Sepolia testnet
-- rows NEVER cross-contaminate. Every INSERT now stamps the active network.
-- ============================================================================

BEGIN;

-- 1. execution_logs.network ---------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'execution_logs' AND column_name = 'network'
    ) THEN
        ALTER TABLE execution_logs
            ADD COLUMN network VARCHAR(16) NOT NULL DEFAULT 'base'
            CHECK (network IN ('base', 'mainnet', 'testnet', 'sepolia'));
        CREATE INDEX IF NOT EXISTS execution_logs_network_idx
            ON execution_logs (network);
    END IF;
END $$;

-- 2. held_tokens.network ------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'held_tokens' AND column_name = 'network'
    ) THEN
        ALTER TABLE held_tokens
            ADD COLUMN network VARCHAR(16) NOT NULL DEFAULT 'base'
            CHECK (network IN ('base', 'mainnet', 'testnet', 'sepolia'));
        CREATE INDEX IF NOT EXISTS held_tokens_network_idx
            ON held_tokens (network);
    END IF;
END $$;

-- 3. target_addresses.network -------------------------------------------------
--    (FK target for execution_logs; stamp so a token's reputation is scoped)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'target_addresses' AND column_name = 'network'
    ) THEN
        ALTER TABLE target_addresses
            ADD COLUMN network VARCHAR(16) NOT NULL DEFAULT 'base'
            CHECK (network IN ('base', 'mainnet', 'testnet', 'sepolia'));
        CREATE INDEX IF NOT EXISTS target_addresses_network_idx
            ON target_addresses (network);
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- End of patch
-- ============================================================================
