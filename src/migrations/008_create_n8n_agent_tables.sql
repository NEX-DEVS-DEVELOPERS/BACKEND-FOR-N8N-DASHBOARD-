-- Migration 008: Create n8n Agent Tables
-- This migration creates tables for n8n agent management and real-time logging

-- Agents Table: Stores n8n webhook configurations
CREATE TABLE IF NOT EXISTS agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    webhook_url TEXT NOT NULL,
    schedule TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'Idle' NOT NULL,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log Sessions Table: Tracks individual agent execution runs
CREATE TABLE IF NOT EXISTS log_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    agent_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Running' NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log Entries Table: Stores individual log messages for sessions
CREATE TABLE IF NOT EXISTS log_entries (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES log_sessions(id) ON DELETE CASCADE,
    log_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- n8n Logs Table: Real-time logging from n8n webhooks
CREATE TABLE IF NOT EXISTS n8n_logs (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL,
    agent_id TEXT NOT NULL,
    log_message TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_log_sessions_user_id ON log_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_log_sessions_agent_id ON log_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_log_sessions_status ON log_sessions(status);
CREATE INDEX IF NOT EXISTS idx_log_entries_session_id ON log_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_n8n_logs_run_id ON n8n_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_n8n_logs_agent_id ON n8n_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_n8n_logs_created_at ON n8n_logs(created_at);

-- Trigger to update updated_at timestamp on agents table
CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at_trigger
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agents_updated_at();
