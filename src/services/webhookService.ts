import { n8nService } from './n8nService';
import { agentService } from './agentService';
import { sseManager } from './sseService';
import { logger } from '../utils/logger';
import { query, querySingle } from '../config/database';
import { AgentStatus } from '../types/agent.types';

/**
 * Webhook Service - Handles webhook triggering and SSE setup
 */
export class WebhookService {
    /**
     * Trigger an agent webhook and set up SSE stream
     * @param agentId Agent ID
     * @param userId User ID
     * @returns Session ID and SSE URL
     */
    async triggerAgent(
        agentId: string,
        userId: string
    ): Promise<{ sessionId: string; sseUrl: string }> {
        try {
            // Get agent
            const agent = await agentService.getAgentById(agentId, userId);
            if (!agent) {
                throw new Error('Agent not found');
            }

            logger.info('Triggering agent webhook:', {
                agentId,
                userId,
                agentName: agent.name,
            });

            // Create log session
            const sessionResult = await querySingle<{ id: string }>(
                `INSERT INTO log_sessions (user_id, agent_id, agent_name, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
                [userId, agentId, agent.name, AgentStatus.Running]
            );

            if (!sessionResult) {
                throw new Error('Failed to create log session');
            }

            const sessionId = sessionResult.id;

            // Trigger n8n webhook
            const n8nResponse = await n8nService.triggerWebhook(agent.webhookUrl, {
                agentId,
                sessionId,
                agentName: agent.name,
            });

            // Update agent status and last run
            await agentService.updateStatus(agentId, userId, AgentStatus.Running);
            await agentService.updateLastRun(agentId, userId);

            // Connect to n8n SSE stream and proxy to frontend
            await sseManager.connectToN8nStream(n8nResponse.sseUrl, sessionId);

            // Log initial entry
            await this.createLogEntry(sessionId, 'Info', `Webhook triggered successfully for agent "${agent.name}"`);

            logger.info('Agent webhook triggered and SSE connected:', {
                agentId,
                sessionId,
                sseUrl: n8nResponse.sseUrl,
            });

            return {
                sessionId,
                sseUrl: `/api/sse/stream/${sessionId}`, // Frontend connects to our SSE endpoint
            };
        } catch (error) {
            logger.error('Failed to trigger agent:', { agentId, userId, error });
            throw error;
        }
    }

    /**
     * Create a log entry
     * @param sessionId Session ID
     * @param logType Log type
     * @param message Log message
     */
    async createLogEntry(
        sessionId: string,
        logType: string,
        message: string
    ): Promise<void> {
        try {
            await query(
                `INSERT INTO log_entries (session_id, log_type, message)
         VALUES ($1, $2, $3)`,
                [sessionId, logType, message]
            );
        } catch (error) {
            logger.error('Failed to create log entry:', { sessionId, error });
        }
    }

    /**
     * Update session status
     * @param sessionId Session ID
     * @param status New status
     */
    async updateSessionStatus(
        sessionId: string,
        status: AgentStatus
    ): Promise<void> {
        try {
            await query(
                `UPDATE log_sessions SET status = $1, completed_at = NOW()
         WHERE id = $2`,
                [status, sessionId]
            );

            logger.info('Session status updated:', { sessionId, status });
        } catch (error) {
            logger.error('Failed to update session status:', { sessionId, error });
        }
    }

    /**
     * Stop an agent run
     * @param sessionId Session ID
     */
    async stopAgentRun(sessionId: string): Promise<void> {
        try {
            // Stop n8n SSE stream
            sseManager.stopN8nStream(sessionId);

            // Update session status
            await this.updateSessionStatus(sessionId, AgentStatus.Cancelled);

            // Create cancellation log
            await this.createLogEntry(
                sessionId,
                'Info',
                'Agent run cancelled by user'
            );

            logger.info('Agent run stopped:', { sessionId });
        } catch (error) {
            logger.error('Failed to stop agent run:', { sessionId, error });
            throw new Error('Failed to stop agent run');
        }
    }
}

export const webhookService = new WebhookService();
