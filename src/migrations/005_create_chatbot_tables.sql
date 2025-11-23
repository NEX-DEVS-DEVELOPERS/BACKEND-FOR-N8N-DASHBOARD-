-- ==============================================
-- CHATBOT DATABASE SCHEMA
-- Migration: 005_create_chatbot_tables
-- ==============================================

-- Chat Sessions Table
-- Tracks user chat sessions with metadata
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    plan_tier VARCHAR(20) NOT NULL DEFAULT 'free',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages Table
-- Stores complete conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    intent VARCHAR(100),
    sentiment VARCHAR(20),
    model_used VARCHAR(100),
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    was_cached BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chatbot Analytics Table
-- Tracks performance metrics and insights
CREATE TABLE IF NOT EXISTS chatbot_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    plan_tier VARCHAR(20) NOT NULL,
    total_messages INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_response_time_ms FLOAT DEFAULT 0,
    cache_hit_rate FLOAT DEFAULT 0,
    intent_distribution JSONB DEFAULT '{}',
    sentiment_distribution JSONB DEFAULT '{}',
    model_usage JSONB DEFAULT '{}',
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, plan_tier)
);

-- Chatbot Feedback Table
-- User ratings and feedback
CREATE TABLE IF NOT EXISTS chatbot_feedback (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(20) CHECK (feedback_type IN ('positive', 'negative', 'neutral')),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Model Usage Table
-- Tracks API usage and costs per model
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    model_name VARCHAR(100) NOT NULL,
    plan_tier VARCHAR(20) NOT NULL,
    request_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_response_time_ms FLOAT DEFAULT 0,
    estimated_cost_usd FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, model_name, plan_tier)
);

-- Chatbot Cache Table
-- Stores cached responses for common queries
CREATE TABLE IF NOT EXISTS chatbot_cache (
    id SERIAL PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    plan_tier VARCHAR(20) NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Chat Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_token ON chat_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON chat_sessions(last_activity);

-- Chat Messages Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_intent ON chat_messages(intent);
CREATE INDEX IF NOT EXISTS idx_chat_messages_model_used ON chat_messages(model_used);

-- Analytics Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_analytics_date ON chatbot_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_analytics_plan_tier ON chatbot_analytics(plan_tier);

-- Feedback Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_feedback_message_id ON chatbot_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_feedback_user_id ON chatbot_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_feedback_rating ON chatbot_feedback(rating);

-- Model Usage Indexes
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_date ON ai_model_usage(date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_model ON ai_model_usage(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_plan ON ai_model_usage(plan_tier);

-- Cache Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_cache_query_hash ON chatbot_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_chatbot_cache_expires_at ON chatbot_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_chatbot_cache_plan_tier ON chatbot_cache(plan_tier);

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_chatbot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
DROP TRIGGER IF EXISTS update_chat_sessions_timestamp ON chat_sessions;
CREATE TRIGGER update_chat_sessions_timestamp
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_chatbot_timestamp();

DROP TRIGGER IF EXISTS update_chatbot_analytics_timestamp ON chatbot_analytics;
CREATE TRIGGER update_chatbot_analytics_timestamp
    BEFORE UPDATE ON chatbot_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_chatbot_timestamp();

DROP TRIGGER IF EXISTS update_ai_model_usage_timestamp ON ai_model_usage;
CREATE TRIGGER update_ai_model_usage_timestamp
    BEFORE UPDATE ON ai_model_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_chatbot_timestamp();

DROP TRIGGER IF EXISTS update_chatbot_cache_timestamp ON chatbot_cache;
CREATE TRIGGER update_chatbot_cache_timestamp
    BEFORE UPDATE ON chatbot_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_chatbot_timestamp();

-- Auto-increment message count on new message
CREATE OR REPLACE FUNCTION increment_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET message_count = message_count + 1,
        last_activity = CURRENT_TIMESTAMP
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_message_count_trigger ON chat_messages;
CREATE TRIGGER chat_message_count_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION increment_session_message_count();

-- Clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM chatbot_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON TABLE chat_sessions IS 'Stores user chat session metadata and state';
COMMENT ON TABLE chat_messages IS 'Complete conversation history with NLP metadata';
COMMENT ON TABLE chatbot_analytics IS 'Daily aggregated analytics per plan tier';
COMMENT ON TABLE chatbot_feedback IS 'User feedback and ratings for chatbot responses';
COMMENT ON TABLE ai_model_usage IS 'Tracks AI model usage, tokens, and costs';
COMMENT ON TABLE chatbot_cache IS 'Response cache for common queries';
