import { pool } from './src/config/database';
import dotenv from 'dotenv';
dotenv.config();

async function checkAgents() {
    try {
        console.log('Listing agents...');
        const result = await pool.query(`SELECT id, name, webhook_url FROM agents`);
        console.table(result.rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

checkAgents();
