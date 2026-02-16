import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { env } from './env';
import { logger } from '../utils/logger';

// Configure Neon for optimal serverless performance
neonConfig.fetchConnectionCache = true;
neonConfig.webSocketConstructor = ws as any; // Enable WebSocket for connection pooling

// Create connection pool for better performance
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

/**
 * Execute a SQL query with connection pooling
 * @param query SQL query string
 * @param params Query parameters
 * @returns Query results
 */
export async function query<T = any>(
  queryText: string,
  params: any[] = []
): Promise<T[]> {
  const start = Date.now();
  try {
    logger.debug('Executing query:', { queryText, params });
    const result = await pool.query(queryText, params);
    const duration = Date.now() - start;
    logger.debug('Query completed:', { duration, rows: result.rowCount });
    return result.rows as T[];
  } catch (error) {
    logger.error('Database query error:', {
      error: error instanceof Error ? error.message : String(error),
      queryText,
    });
    throw error;
  }
}

/**
 * Execute a single query and return first result
 * @param queryText SQL query string
 * @param params Query parameters
 * @returns First row or null
 */
export async function querySingle<T = any>(
  queryText: string,
  params: any[] = []
): Promise<T | null> {
  const results = await query<T>(queryText, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1 as connection_test');
    logger.info('✅ Neon DB connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Neon DB connection failed:', error);
    return false;
  }
}

/**
 * Initialize database tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database schema...');

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        plan_tier VARCHAR(50) DEFAULT 'free',
        has_247_addon BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Agents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        webhook_url TEXT NOT NULL,
        schedule TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Idle',
        method VARCHAR(10) DEFAULT 'POST',
        input_payload TEXT,
        last_run_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Log Sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        agent_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Idle',
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    // Log Entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES log_sessions(id) ON DELETE CASCADE,
        log_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Support Requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        issue TEXT NOT NULL,
        specialist_id VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `);

    // Contact Submissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Request Changes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Token Blacklist table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        reason VARCHAR(100),
        blacklisted_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User Preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        email_notifications BOOLEAN DEFAULT true,
        agent_status_notifications BOOLEAN DEFAULT true,
        weekly_reports BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Chat History table (base table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        response TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add optional columns to chat_history (ignore errors if they already exist)
    try {
      await pool.query(`ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS session_id UUID`);
    } catch (e) { /* Column might already exist */ }

    // Set up secure chat storage tables (using IF NOT EXISTS to preserve data)
    try {
      // Secure Chat Sessions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_key VARCHAR(64) NOT NULL,
          title VARCHAR(100) DEFAULT 'New Conversation',
          message_count INTEGER DEFAULT 0,
          has_user_messages BOOLEAN DEFAULT false,
          first_user_message_preview VARCHAR(100),
          model_used VARCHAR(50),
          total_tokens_used INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
        )
      `);

      // Encrypted Chat Memory table - stores encrypted messages
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_memory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          encrypted_messages BYTEA NOT NULL,
          encryption_iv BYTEA NOT NULL,
          encryption_version INTEGER DEFAULT 1,
          message_count INTEGER DEFAULT 0,
          storage_size_bytes INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Chat Analytics Daily (Aggregated, not per-message)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_analytics_daily (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
          total_sessions INTEGER DEFAULT 0,
          total_messages_sent INTEGER DEFAULT 0,
          total_messages_received INTEGER DEFAULT 0,
          total_tokens_used INTEGER DEFAULT 0,
          avg_response_time_ms INTEGER DEFAULT 0,
          plan_tier VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, analytics_date)
        )
      `);

      logger.info('✅ Secure chat storage tables ready');
    } catch (chatTableError: any) {
      // Log the specific error for debugging
      logger.warn('⚠️ Chat storage tables setup issue:', chatTableError?.message || chatTableError);
    }

    // Dev Credit Logs table - tracks dev credit usage
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dev_credit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        hours_used DECIMAL(5,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        category VARCHAR(50) DEFAULT 'change',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    // Changelog Entries table - system updates and changes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS changelog_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL DEFAULT 'improvement',
        version VARCHAR(20),
        is_public BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User Activity Log table - tracks user actions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Invoices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'paid',
        plan_name VARCHAR(50),
        billing_period_start TIMESTAMP,
        billing_period_end TIMESTAMP,
        pdf_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // N8n Logs table  - Real-time logging from n8n webhooks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS n8n_logs (
        id SERIAL PRIMARY KEY,
        run_id UUID NOT NULL,
        agent_id TEXT NOT NULL,
        log_message TEXT NOT NULL,
        status TEXT DEFAULT 'running',
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_log_sessions_user_id ON log_sessions(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_log_entries_session_id ON log_entries(session_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON support_requests(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_support_requests_submitted_at ON support_requests(submitted_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id)');

    // Secure Chat Storage indexes (only if tables were created)
    try {
      await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_has_user_messages ON chat_sessions(has_user_messages)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires_at ON chat_sessions(expires_at)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_memory_session_id ON chat_memory(session_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON chat_memory(user_id)');
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_memory_unique_session ON chat_memory(session_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_chat_analytics_daily_user_date ON chat_analytics_daily(user_id, analytics_date DESC)');
    } catch (chatIndexError) {
      logger.debug('Could not create chat storage indexes');
    }


    // Dashboard table indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_dev_credit_logs_user_id ON dev_credit_logs(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_dev_credit_logs_status ON dev_credit_logs(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_dev_credit_logs_created_at ON dev_credit_logs(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_changelog_entries_created_at ON changelog_entries(created_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_changelog_entries_is_public ON changelog_entries(is_public)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at)');

    // N8n Logs indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_n8n_logs_run_id ON n8n_logs(run_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_n8n_logs_agent_id ON n8n_logs(agent_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_n8n_logs_created_at ON n8n_logs(created_at)');


    // User Dashboard Data table (for real-time updates)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_dashboard_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        plan_features JSONB DEFAULT '{}',
        support_requests_data JSONB DEFAULT '{}',
        change_requests_data JSONB DEFAULT '{}',
        support_timer INTEGER DEFAULT 0,
        security_audits_last_check TIMESTAMP,
        last_updated TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for user_dashboard_data
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_dashboard_data_user_id ON user_dashboard_data(user_id)');

    // Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for notifications
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)');

    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export { pool };
