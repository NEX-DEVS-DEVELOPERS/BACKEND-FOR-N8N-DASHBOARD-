import { query, querySingle } from '../config/database';
import { Agent, AgentStatus, CreateAgentDTO, UpdateAgentDTO } from '../types/agent.types';
import { logger } from '../utils/logger';
import { validateWebhookUrl } from '../utils/validators';

/**
 * Agent Service - Business logic for agent management
 */
export class AgentService {
    /**
     * Get all agents for a user
     * @param userId User ID
     * @returns Array of agents
     */
    async getUserAgents(userId: string): Promise<Agent[]> {
        try {
            // Fetch from database
            const agents = await query<Agent>(
                `SELECT id, user_id as "userId", name, webhook_url as "webhookUrl", 
                schedule, status, last_run_at as "lastRunAt", 
                created_at as "createdAt", updated_at as "updatedAt"
         FROM agents WHERE user_id = $1 ORDER BY created_at DESC`,
                [userId]
            );

            return agents;
        } catch (error) {
            logger.error('Error fetching user agents:', { userId, error });
            throw new Error('Failed to fetch agents');
        }
    }

    /**
     * Get agent by ID
     * @param agentId Agent ID
     * @param userId User ID (for authorization)
     * @returns Agent or null
     */
    async getAgentById(agentId: string, userId: string): Promise<Agent | null> {
        try {
            const agent = await querySingle<Agent>(
                `SELECT id, user_id as "userId", name, webhook_url as "webhookUrl", 
                schedule, status, last_run_at as "lastRunAt", 
                created_at as "createdAt", updated_at as "updatedAt"
         FROM agents WHERE id = $1 AND user_id = $2`,
                [agentId, userId]
            );

            return agent;
        } catch (error) {
            logger.error('Error fetching agent:', { agentId, userId, error });
            throw new Error('Failed to fetch agent');
        }
    }

    /**
     * Create a new agent
     * @param userId User ID
     * @param data Agent data
     * @returns Created agent
     */
    async createAgent(userId: string, data: CreateAgentDTO): Promise<Agent> {
        try {
            // Validate webhook URL
            if (!validateWebhookUrl(data.webhookUrl)) {
                throw new Error('Invalid webhook URL or domain not whitelisted');
            }

            // Determine initial status
            const status = data.schedule ? AgentStatus.Scheduled : AgentStatus.Idle;

            // Insert into database
            const result = await querySingle<Agent>(
                `INSERT INTO agents (user_id, name, webhook_url, schedule, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id as "userId", name, webhook_url as "webhookUrl", 
                   schedule, status, last_run_at as "lastRunAt", 
                   created_at as "createdAt", updated_at as "updatedAt"`,
                [userId, data.name, data.webhookUrl, data.schedule || null, status]
            );

            if (!result) {
                throw new Error('Failed to create agent');
            }

            logger.info('Agent created:', { userId, agentId: result.id });

            return result;
        } catch (error) {
            logger.error('Error creating agent:', { userId, data, error });
            throw error;
        }
    }

    /**
     * Update an agent
     * @param agentId Agent ID
     * @param userId User ID
     * @param data Update data
     * @returns Updated agent
     */
    async updateAgent(
        agentId: string,
        userId: string,
        data: UpdateAgentDTO
    ): Promise<Agent | null> {
        try {
            // Build update query dynamically
            const updates: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (data.name !== undefined) {
                updates.push(`name = $${paramCount++}`);
                values.push(data.name);
            }

            if (data.webhookUrl !== undefined) {
                if (!validateWebhookUrl(data.webhookUrl)) {
                    throw new Error('Invalid webhook URL or domain not whitelisted');
                }
                updates.push(`webhook_url = $${paramCount++}`);
                values.push(data.webhookUrl);
            }

            if (data.schedule !== undefined) {
                updates.push(`schedule = $${paramCount++}`);
                values.push(data.schedule);
            }

            if (data.status !== undefined) {
                updates.push(`status = $${paramCount++}`);
                values.push(data.status);
            }

            if (updates.length === 0) {
                throw new Error('No fields to update');
            }

            updates.push(`updated_at = NOW()`);
            values.push(agentId, userId);

            const result = await querySingle<Agent>(
                `UPDATE agents SET ${updates.join(', ')}
         WHERE id = $${paramCount++} AND user_id = $${paramCount++}
         RETURNING  id, user_id as "userId", name, webhook_url as "webhookUrl", 
                   schedule, status, last_run_at as "lastRunAt", 
                   created_at as "createdAt", updated_at as "updatedAt"`,
                values
            );

            if (result) {
                logger.info('Agent updated:', { agentId, userId });
            }

            return result;
        } catch (error) {
            logger.error('Error updating agent:', { agentId, userId, data, error });
            throw error;
        }
    }

    /**
     * Delete an agent
     * @param agentId Agent ID
     * @param userId User ID
     * @returns True if deleted
     */
    async deleteAgent(agentId: string, userId: string): Promise<boolean> {
        try {
            const result = await query(
                `DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING id`,
                [agentId, userId]
            );

            const deleted = result.length > 0;

            if (deleted) {
                logger.info('Agent deleted:', { agentId, userId });
            }

            return deleted;
        } catch (error) {
            logger.error('Error deleting agent:', { agentId, userId, error });
            throw new Error('Failed to delete agent');
        }
    }

    /**
     * Update agent status
     * @param agentId Agent ID
     * @param userId User ID
     * @param status New status
     */
    async updateStatus(
        agentId: string,
        userId: string,
        status: AgentStatus
    ): Promise<void> {
        try {
            await query(
                `UPDATE agents SET status = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
                [status, agentId, userId]
            );

            logger.info('Agent status updated:', { agentId, status });
        } catch (error) {
            logger.error('Error updating agent status:', { agentId, status, error });
        }
    }

    /**
     * Update last run timestamp
     * @param agentId Agent ID
     * @param userId User ID
     */
    async updateLastRun(agentId: string, userId: string): Promise<void> {
        try {
            await query(
                `UPDATE agents SET last_run_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
                [agentId, userId]
            );
        } catch (error) {
            logger.error('Error updating last run:', { agentId, error });
        }
    }
}

export const agentService = new AgentService();
