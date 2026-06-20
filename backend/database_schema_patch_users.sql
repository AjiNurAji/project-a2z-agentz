-- Tabel users untuk autentikasi (login/register)
-- Jalankan SETELAH database_schema.sql

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL        PRIMARY KEY,
    email           VARCHAR(255)  UNIQUE NOT NULL,
    password_hash   TEXT          NOT NULL,        -- bcrypt $2b$...
    wallet_address  VARCHAR(42),                   -- opsional, 0x... Base addr
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP,
    CONSTRAINT chk_wallet CHECK (
        wallet_address IS NULL OR wallet_address ~ '^0x[a-fA-F0-9]{40}$'
    )
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
