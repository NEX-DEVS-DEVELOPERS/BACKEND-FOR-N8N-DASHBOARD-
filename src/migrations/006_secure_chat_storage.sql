-- ==============================================
-- SECURE CHAT STORAGE SYSTEM
-- ==============================================
-- This migration creates a professional, secure chat storage system
-- that encrypts messages, limits storage, and organizes by user.
-- ==============================================

-- Drop old inefficient tables if they exist
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS chatbot_cache CASCADE;
DROP TABLE IF EXISTS chatbot_analytics CASCADE;
DROP TABLE IF EXISTS chatbot_feedback CASCADE;

-- ==============================================
-- 1. CHAT SESSIONS TABLE
-- ==============================================
-- Stores session metadata only (no message content here)
-- Each session belongs to a user and tracks usage
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_key VARCHAR(64) NOT NULL UNIQUE, -- Unique session identifier
    title VARCHAR(100) DEFAULT 'New Conversation',
    message_count INTEGER DEFAULT 0,
    has_user_messages BOOLEAN DEFAULT false, -- Only true if user has sent messages (not just greetings)
    first_user_message_preview VARCHAR(100), -- Preview of first user message for history
    model_used VARCHAR(50), -- Which model was used
    total_tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days') -- Auto cleanup
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_has_user_messages ON chat_sessions(has_user_messages);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires_at ON chat_sessions(expires_at);

-- ==============================================
-- 2. ENCRYPTED CHAT MEMORY TABLE
-- ==============================================
-- Stores compressed, encrypted chat memory instead of full messages
-- This dramatically reduces database size while maintaining context
CREATE TABLE IF NOT EXISTS chat_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Encrypted memory blob (compressed context, not full messages)
    -- Uses AES-256 encryption with user-specific key
    encrypted_memory BYTEA NOT NULL,
    
    -- Encryption metadata
    encryption_iv BYTEA NOT NULL, -- Initialization vector for AES
    encryption_version INTEGER DEFAULT 1, -- For future algorithm changes
    
    -- Memory metrics
    memory_size_bytes INTEGER DEFAULT 0,
    context_window_used INTEGER DEFAULT 0, -- Tokens used in context
    
    -- Lifecycle
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_chat_memory_session_id ON chat_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON chat_memory(user_id);

-- ==============================================
-- 3. CHAT ANALYTICS TABLE (Minimal, Aggregated)
-- ==============================================
-- Stores daily aggregated stats, not individual message data
CREATE TABLE IF NOT EXISTS chat_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Aggregated metrics
    total_sessions INTEGER DEFAULT 0,
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_received INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    
    -- Plan tracking
    plan_tier VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one row per user per day
    UNIQUE(user_id, analytics_date)
);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_daily_user_date ON chat_analytics_daily(user_id, analytics_date DESC);

-- ==============================================
-- 4. CLEANUP FUNCTION - Auto-delete expired sessions
-- ==============================================
CREATE OR REPLACE FUNCTION cleanup_expired_chat_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM chat_sessions
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. UPDATE CHAT HISTORY TABLE (Simplified)
-- ==============================================
-- Keep the existing table but make it more efficient
-- Only stores the minimal data needed for context

-- First check if chat_history exists and update it
DO $$
BEGIN
    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_history' AND column_name = 'session_id') THEN
        ALTER TABLE chat_history ADD COLUMN session_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_history' AND column_name = 'is_compressed') THEN
        ALTER TABLE chat_history ADD COLUMN is_compressed BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_history' AND column_name = 'message_hash') THEN
        ALTER TABLE chat_history ADD COLUMN message_hash VARCHAR(64);
    END IF;
END $$;

-- Create index on session_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
