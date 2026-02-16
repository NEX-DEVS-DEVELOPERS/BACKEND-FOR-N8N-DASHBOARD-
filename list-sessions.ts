import { pool } from './src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function checkSessions() {
    try {
        const result = await pool.query(`SELECT id, user_id, agent_id, agent_name, status, started_at FROM log_sessions`);
        for (const row of result.rows) {
            console.log(`ID: ${row.id}, Agent: ${row.agent_name}, Status: ${row.status}, Started: ${row.started_at}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

checkSessions();
