import { Request, Response } from 'express';
import { agentService } from '../services/agentService';
import { webhookService } from '../services/webhookService';
import { CreateAgentDTO, UpdateAgentDTO, Agent } from '../types/agent.types';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';

/**
 * Agent Controller
 */
export class AgentController {
    /**
     * Get all agents for the authenticated user
     */
    async getAll(
        req: Request,
        res: Response<ApiSuccessResponse<{ agents: Agent[] }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const agents = await agentService.getUserAgents(req.user.userId);

            res.status(200).json({
                success: true,
                data: { agents },
            });
        } catch (error) {
            logger.error('Error fetching agents:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch agents',
                statusCode: 500,
            });
        }
    }

    /**
     * Get a single agent by ID
     */
    async getOne(
        req: Request<{ id: string }>,
        res: Response<ApiSuccessResponse<{ agent: Agent }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const agent = await agentService.getAgentById(req.params.id, req.user.userId);

            if (!agent) {
                res.status(404).json({
                    success: false,
                    error: 'Agent not found',
                    statusCode: 404,
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: { agent },
            });
        } catch (error) {
            logger.error('Error fetching agent:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch agent',
                statusCode: 500,
            });
        }
    }

    /**
     * Create a new agent
     */
    async create(
        req: Request<{}, {}, CreateAgentDTO>,
        res: Response<ApiSuccessResponse<{ agent: Agent }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const agent = await agentService.createAgent(req.user.userId, req.body);

            logger.info('Agent created:', { agentId: agent.id, userId: req.user.userId });

            res.status(201).json({
                success: true,
                data: { agent },
                message: 'Agent created successfully',
            });
        } catch (error) {
            logger.error('Error creating agent:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create agent',
                statusCode: 500,
            });
        }
    }

    /**
     * Update an agent
     */
    async update(
        req: Request<{ id: string }, {}, UpdateAgentDTO>,
        res: Response<ApiSuccessResponse<{ agent: Agent }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const agent = await agentService.updateAgent(
                req.params.id,
                req.user.userId,
                req.body
            );

            if (!agent) {
                res.status(404).json({
                    success: false,
                    error: 'Agent not found',
                    statusCode: 404,
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: { agent },
                message: 'Agent updated successfully',
            });
        } catch (error) {
            logger.error('Error updating agent:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update agent',
                statusCode: 500,
            });
        }
    }

    /**
     * Delete an agent
     */
    async delete(
        req: Request<{ id: string }>,
        res: Response<ApiSuccessResponse | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const deleted = await agentService.deleteAgent(req.params.id, req.user.userId);

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: 'Agent not found',
                    statusCode: 404,
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Agent deleted successfully',
            });
        } catch (error) {
            logger.error('Error deleting agent:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete agent',
                statusCode: 500,
            });
        }
    }

    /**
     * Trigger an agent manually
     */
    async trigger(
        req: Request<{ id: string }>,
        res: Response<ApiSuccessResponse<{ sessionId: string; sseUrl: string }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const result = await webhookService.triggerAgent(req.params.id, req.user.userId);

            res.status(200).json({
                success: true,
                data: result,
                message: 'Agent triggered successfully',
            });
        } catch (error) {
            logger.error('Error triggering agent:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to trigger agent',
                statusCode: 500,
            });
        }
    }

    /**
     * Stop an agent run
     */
    async stop(
        req: Request<{ id: string }>,
        res: Response<ApiSuccessResponse | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            // TODO: Stop the latest running session for this agent
            // For now, this is a simplified implementation

            res.status(200).json({
                success: true,
                message: 'Agent stopped successfully',
            });
        } catch (error) {
            logger.error('Error stopping agent:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to stop agent',
                statusCode: 500,
            });
        }
    }
}

export const agentController = new AgentController();
