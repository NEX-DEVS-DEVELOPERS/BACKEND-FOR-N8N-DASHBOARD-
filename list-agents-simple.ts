import { pool } from './src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function checkAgents() {
    try {
        const result = await pool.query(`SELECT id, name, webhook_url FROM agents`);
        for (const row of result.rows) {
            console.log(`ID: ${row.id}, Name: ${row.name}, URL: ${row.webhook_url}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

checkAgents();
