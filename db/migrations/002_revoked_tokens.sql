-- Revoked Tokens Table for Refresh Token Blacklisting
CREATE TABLE IF NOT EXISTS revoked_tokens (
    token VARCHAR(512) PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
