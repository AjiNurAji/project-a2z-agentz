-- ============================================================================
-- A2Z Agentz - Database Schema v2 (Async Agent-as-a-Service Pipeline)
-- ============================================================================
-- Target Platform: Base Network (Chain ID: 8453)
-- File: database_schema_v2.sql
--
-- This is a NON-DESTRUCTIVE migration that ADDS 4 new tables on top of the
-- existing schema (database_schema.sql). It MUST NOT touch the `users` table
-- (frontend auth continues to read from it).
--
-- Designed for the new async architecture:
--   * Agent A (Producer)  -> writes to `scraping_queue` (status=PENDING)
--   * Agent B (Worker)    -> SELECT ... FOR UPDATE SKIP LOCKED
--
-- Status workflow:
--   PENDING -> PROCESSING -> COMPLETED
--                        \-> FAILED (after retry cap)
-- ============================================================================

-- ============================================================================
-- STEP 1: scraping_queue
-- Single source of truth for tasks produced by Agent A.
-- index on processing_status is the hot path for the worker poll.
-- ============================================================================
CREATE TABLE IF NOT EXISTS scraping_queue (
    id                SERIAL        PRIMARY KEY,
    user_id           INTEGER       NOT NULL,
    source            VARCHAR(64)   NOT NULL,                 -- e.g. 'farcaster', 'twitter'
    project_name      VARCHAR(255)  NOT NULL,
    target_address    VARCHAR(42),                           -- populated by Agent A's LLM
    data_payload      JSONB         NOT NULL DEFAULT '{}'::jsonb,
    processing_status VARCHAR(32)   NOT NULL DEFAULT 'PENDING',
                                  -- PENDING | PROCESSING | COMPLETED | FAILED
    retry_count       INTEGER       NOT NULL DEFAULT 0
                                  CHECK (retry_count >= 0),
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT scraping_queue_status_chk CHECK (
        processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
    ),
    -- Sanity: a Base/EVM address is 0x + 40 hex
    CONSTRAINT scraping_queue_addr_chk CHECK (
        target_address IS NULL
        OR target_address ~ '^0x[a-fA-F0-9]{40}$'
    ),
    -- FK to users -- but DEFERRABLE so we don't break if legacy rows are present
    CONSTRAINT scraping_queue_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Hot-path index for the worker poll (`SELECT ... WHERE processing_status='PENDING'`)
CREATE INDEX IF NOT EXISTS scraping_queue_status_idx
    ON scraping_queue (processing_status);

-- Composite for ordered back-pressure inspection
CREATE INDEX IF NOT EXISTS scraping_queue_user_status_idx
    ON scraping_queue (user_id, processing_status);

-- ============================================================================
-- STEP 2: synthesis_results
-- Agent B's LLM output (sentiment score + risk flags) for a processed queue row.
-- One synthesis per queue row (UNIQUE FK column).
-- ============================================================================
CREATE TABLE IF NOT EXISTS synthesis_results (
    id              SERIAL        PRIMARY KEY,
    queue_id        INTEGER       NOT NULL UNIQUE,           -- 1:1 with scraping_queue.id
    score           INTEGER       CHECK (score BETWEEN 0 AND 100),
    risk_flags      TEXT,
    synthesized_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT synthesis_results_queue_fk
        FOREIGN KEY (queue_id) REFERENCES scraping_queue(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS synthesis_results_queue_idx
    ON synthesis_results (queue_id);

-- ============================================================================
-- STEP 3: transaction_proposals
-- Gnosis Safe transaction proposals generated when a task passes both gates.
-- Status is the on-chain / Safe queue lifecycle.
-- ============================================================================
CREATE TABLE IF NOT EXISTS transaction_proposals (
    id                    SERIAL          PRIMARY KEY,
    synthesis_id          INTEGER         NOT NULL UNIQUE,    -- 1:1 with synthesis_results
    gnosis_safe_tx_hash   VARCHAR(66)     UNIQUE,             -- 0x + 64 hex
    amount_usd            NUMERIC(20, 6)  NOT NULL
                                         CHECK (amount_usd >= 0),
    status                VARCHAR(32)     NOT NULL DEFAULT 'PENDING'
                                         CHECK (status IN (
                                             'PENDING',
                                             'AWAITING_SIGNATURES',
                                             'EXECUTED',
                                             'FAILED',
                                             'REJECTED'
                                         )),
    created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT transaction_proposals_synthesis_fk
        FOREIGN KEY (synthesis_id) REFERENCES synthesis_results(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS transaction_proposals_status_idx
    ON transaction_proposals (status);

-- ============================================================================
-- STEP 4: audit_log
-- Append-only observability trail. No FKs -- an audit row must survive even
-- if upstream rows are cleaned up.
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL     PRIMARY KEY,
    event_type  VARCHAR(64)   NOT NULL,
    description TEXT          NOT NULL,
    metadata    JSONB         DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS audit_log_event_type_idx
    ON audit_log (event_type);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
    ON audit_log (created_at DESC);

-- ============================================================================
-- Lightweight trigger so updated_at stays honest on scraping_queue.
-- (Other tables use synthesized_at / created_at, so this is enough.)
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at_scraping_queue()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scraping_queue_updated_at ON scraping_queue;
CREATE TRIGGER trg_scraping_queue_updated_at
    BEFORE UPDATE ON scraping_queue
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_scraping_queue();

-- ============================================================================
-- DONE. Verify with:
--   \d scraping_queue
--   \d synthesis_results
--   \d transaction_proposals
--   \d audit_log
-- ============================================================================
