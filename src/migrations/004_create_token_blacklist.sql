-- Migration: Create token blacklist table for secure logout
-- This table stores invalidated JWT tokens to prevent reuse after logout

CREATE TABLE IF NOT EXISTS token_blacklist (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    blacklisted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    reason VARCHAR(50) DEFAULT 'logout',
    
    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Index for fast token lookup during authentication
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- Add comment for documentation
COMMENT ON TABLE token_blacklist IS 'Stores invalidated JWT tokens to prevent reuse after logout';
COMMENT ON COLUMN token_blacklist.token_hash IS 'SHA-256 hash of the JWT token for security';
COMMENT ON COLUMN token_blacklist.expires_at IS 'When the token would naturally expire (for cleanup)';
