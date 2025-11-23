import { PoolClient } from '@neondatabase/serverless';
import { pool } from '../config/database';
import { logger } from './logger';

/**
 * Transaction helper for atomic database operations
 * Provides automatic rollback on errors and proper connection management
 */

export class Transaction {
    private client: PoolClient | null = null;
    private isActive = false;

    /**
     * Begin a new transaction
     */
    async begin(): Promise<void> {
        if (this.isActive) {
            throw new Error('Transaction already in progress');
        }

        try {
            this.client = await pool.connect();
            await this.client.query('BEGIN');
            this.isActive = true;
            logger.debug('Transaction started');
        } catch (error) {
            if (this.client) {
                this.client.release();
                this.client = null;
            }
            logger.error('Failed to start transaction:', error);
            throw error;
        }
    }

    /**
     * Execute a query within the transaction
     */
    async query<T = any>(queryText: string, params: any[] = []): Promise<T[]> {
        if (!this.isActive || !this.client) {
            throw new Error('No active transaction');
        }

        try {
            logger.debug('Transaction query:', { queryText, params });
            const result = await this.client.query(queryText, params);
            return result.rows as T[];
        } catch (error) {
            logger.error('Transaction query error:', {
                error: error instanceof Error ? error.message : String(error),
                queryText,
            });
            throw error;
        }
    }

    /**
     * Execute a query and return first result
     */
    async querySingle<T = any>(queryText: string, params: any[] = []): Promise<T | null> {
        const results = await this.query<T>(queryText, params);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Commit the transaction
     */
    async commit(): Promise<void> {
        if (!this.isActive || !this.client) {
            throw new Error('No active transaction to commit');
        }

        try {
            await this.client.query('COMMIT');
            logger.debug('Transaction committed');
        } catch (error) {
            logger.error('Failed to commit transaction:', error);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    /**
     * Rollback the transaction
     */
    async rollback(): Promise<void> {
        if (!this.isActive || !this.client) {
            logger.warn('No active transaction to rollback');
            return;
        }

        try {
            await this.client.query('ROLLBACK');
            logger.debug('Transaction rolled back');
        } catch (error) {
            logger.error('Failed to rollback transaction:', error);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    /**
     * Cleanup transaction resources
     */
    private cleanup(): void {
        if (this.client) {
            this.client.release();
            this.client = null;
        }
        this.isActive = false;
    }

    /**
     * Check if transaction is active
     */
    isTransactionActive(): boolean {
        return this.isActive;
    }
}

/**
 * Execute a function within a transaction
 * Automatically commits on success, rolls back on error
 * 
 * @example
 * await withTransaction(async (trx) => {
 *   await trx.query('UPDATE users SET plan_tier = $1 WHERE id = $2', ['pro', userId]);
 *   await trx.query('INSERT INTO audit_log (user_id, action) VALUES ($1, $2)', [userId, 'upgrade']);
 * });
 */
export async function withTransaction<T>(
    callback: (transaction: Transaction) => Promise<T>
): Promise<T> {
    const transaction = new Transaction();

    try {
        await transaction.begin();
        const result = await callback(transaction);
        await transaction.commit();
        return result;
    } catch (error) {
        await transaction.rollback();
        logger.error('Transaction failed and rolled back:', error);
        throw error;
    }
}
