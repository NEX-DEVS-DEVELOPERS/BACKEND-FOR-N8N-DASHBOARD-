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

    logger.info('✅ Database schema initialized successfully');
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export { pool };
