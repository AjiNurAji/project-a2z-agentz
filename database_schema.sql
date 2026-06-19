-- ============================================================================
-- A2Z Agentz - Core Database Schema (PostgreSQL)
-- Target Platform: Base Network (Chain ID: 8453)
-- File: database_schema.sql
-- Revision: widened status CHECK constraints to accept the uppercase
--            workflow values used by agent_b.py
--            (SUCCESS / PENDING_APPROVAL / FAILED / REJECTED_BLACKLIST /
--             BLACKLISTED) while keeping legacy lowercase values valid for
--            in-flight rows.
-- ============================================================================

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table: target_addresses
-- Stores sentiment-scored project target addresses on Base Network.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS target_addresses (
    address          VARCHAR(42)    PRIMARY KEY,
    sentiment_score  INTEGER        NOT NULL CHECK (sentiment_score BETWEEN 0 AND 100),
    status           VARCHAR(32)    NOT NULL DEFAULT 'BLACKLISTED'
                                     CHECK (status IN (
                                         'pending',
                                         'active',
                                         'paused',
                                         'blacklisted',
                                         'BLACKLISTED'
                                     )),
    updated_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- Table: execution_logs
-- Stores on-chain execution records keyed by transaction hash id.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS execution_logs (
    tx_hash_id              VARCHAR(66)    PRIMARY KEY,
    project_target_address  VARCHAR(42)    NOT NULL,
    amount_usd              NUMERIC(20, 6) NOT NULL CHECK (amount_usd >= 0),
    status                  VARCHAR(32)    NOT NULL DEFAULT 'PENDING_APPROVAL'
                                          CHECK (status IN (
                                              'submitted',
                                              'pending',
                                              'pending_approval',
                                              'confirmed',
                                              'reverted',
                                              'failed',
                                              'rejected_blacklist',
                                              'SUCCESS',
                                              'PENDING_APPROVAL',
                                              'FAILED',
                                              'REJECTED_BLACKLIST'
                                          )),
    created_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- Optimal Indexing
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS execution_logs_status_idx
    ON execution_logs (status);

CREATE INDEX IF NOT EXISTS execution_logs_project_idx
    ON execution_logs (project_target_address);

CREATE INDEX IF NOT EXISTS execution_logs_status_project_idx
    ON execution_logs (status, project_target_address);

CREATE INDEX IF NOT EXISTS target_addresses_status_idx
    ON target_addresses (status);

-- ----------------------------------------------------------------------------
-- Referential integrity
-- ----------------------------------------------------------------------------
ALTER TABLE execution_logs
    DROP CONSTRAINT IF EXISTS execution_logs_project_target_address_fkey;

ALTER TABLE execution_logs
    ADD CONSTRAINT execution_logs_project_target_address_fkey
        FOREIGN KEY (project_target_address)
        REFERENCES target_addresses (address)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

-- ----------------------------------------------------------------------------
-- Auto-update of updated_at on target_addresses
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS target_addresses_set_updated_at ON target_addresses;
CREATE TRIGGER target_addresses_set_updated_at
    BEFORE UPDATE ON target_addresses
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================================
-- End of schema
-- ============================================================================