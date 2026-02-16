/**
 * Migration Runner for n8n Agent Tables
 * Uses the project's existing database configuration and @neondatabase/serverless
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '../config/database';
import { logger } from '../utils/logger';

async function runMigration() {
    try {
        console.log('🚀 Starting n8n agent tables migration...');

        // Read migration file
        const migrationPath = join(process.cwd(), 'src', 'migrations', '008_create_n8n_agent_tables.sql');
        console.log(`Reading migration from: ${migrationPath}`);
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        // Split SQL into individual statements if necessary, 
        // but neon pool.query can handle multiple statements in one call usually.
        // For safety, we'll execute it as one block.
        console.log('Executing SQL schema...');
        await query(migrationSQL);

        console.log('✅ Migration completed successfully!');

        // Verify tables
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('agents', 'log_sessions', 'log_entries', 'n8n_logs')
        `);

        console.log('\nVerified tables:');
        tables.forEach((row: any) => console.log(`  - ${row.table_name}`));

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
