import { pool } from './src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function checkDatabase() {
    try {
        console.log('Checking database counts...');

        const tables = ['users', 'agents', 'log_sessions', 'n8n_logs', 'support_requests', 'contact_submissions', 'request_changes', 'chat_history'];

        for (const table of tables) {
            try {
                const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`Table ${table.padEnd(20)}: ${result.rows[0].count} rows`);
            } catch (e: any) {
                console.log(`Table ${table.padEnd(20)}: Error - ${e.message}`);
            }
        }

    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

checkDatabase();
