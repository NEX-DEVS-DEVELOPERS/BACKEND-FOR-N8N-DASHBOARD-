import { Request, Response } from 'express';
import { query, querySingle } from '../config/database';
import { logger } from '../utils/logger';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';
import { socketService } from '../services/socketService';

interface N8nLog {
    id: number;
    run_id: string;
    agent_id: string;
    log_message: string;
    status: string;
    payload: any;
    created_at: Date;
}

interface N8nLogRequest {
    run_id: string;
    agent_id: string;
    log_message: string;
    status?: string;
    payload?: any;
}

/**
 * N8n Logs Controller
 * Handles CRUD operations for n8n execution logs
 */
export class N8nLogsController {
    /**
     * Get logs by run_id
     * @route GET /api/n8n-logs/:runId
     */
    async getLogsByRunId(
        req: Request<{ runId: string }>,
        res: Response<ApiSuccessResponse<{ logs: N8nLog[] }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { runId } = req.params;

            if (!runId || runId === 'undefined') {
                res.status(400).json({
                    success: false,
                    error: 'Valid Run ID is required',
                    statusCode: 400,
                });
                return;
            }

            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(runId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid Run ID format',
                    statusCode: 400,
                });
                return;
            }

            const logs = await query<N8nLog>(
                `SELECT id, run_id as "runId", agent_id as "agentId", 
                        log_message as "logMessage", status, payload, 
                        created_at as "createdAt"
                 FROM n8n_logs 
                 WHERE run_id = $1 
                 ORDER BY created_at ASC`,
                [runId]
            );

            res.status(200).json({
                success: true,
                data: { logs },
            });
        } catch (error) {
            logger.error('Error fetching n8n logs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch logs',
                statusCode: 500,
            });
        }
    }

    /**
     * Create a new log entry (called by n8n webhook)
     * @route POST /api/n8n-logs
     */
    async createLog(
        req: Request<{}, {}, N8nLogRequest & { user_id?: string }>,
        res: Response<ApiSuccessResponse<{ log: N8nLog }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { run_id, agent_id, log_message, status = 'running', payload, user_id } = req.body;

            if (!run_id || !agent_id || !log_message) {
                res.status(400).json({
                    success: false,
                    error: 'run_id, agent_id, and log_message are required',
                    statusCode: 400,
                });
                return;
            }

            const result = await query<N8nLog>(
                `INSERT INTO n8n_logs (run_id, agent_id, log_message, status, payload)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, run_id as "runId", agent_id as "agentId", 
                           log_message as "logMessage", status, payload, 
                           created_at as "createdAt"`,
                [run_id, agent_id, log_message, status, payload ? JSON.stringify(payload) : null]
            );

            const log = result[0];

            logger.info('N8n log created:', { runId: run_id, agentId: agent_id });

            // Stream log to user via WebSocket
            let socketUserId = user_id;

            // If user_id wasn't provided, try to find it from the session
            if (!socketUserId) {
                try {
                    const session = await querySingle<{ user_id: string }>(
                        `SELECT user_id FROM log_sessions WHERE id = $1`,
                        [run_id]
                    );
                    if (session) {
                        socketUserId = session.user_id;
                    }
                } catch (e) {
                    logger.debug('Could not resolve user_id from session for run_id:', run_id);
                }
            }

            if (socketUserId) {
                socketService.emitToUser(socketUserId, 'n8n_log_new', log);
            }

            res.status(201).json({
                success: true,
                data: { log },
            });
        } catch (error) {
            logger.error('Error creating n8n log:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create log',
                statusCode: 500,
            });
        }
    }

    /**
     * Update log status
     * @route PATCH /api/n8n-logs/:runId/status
     */
    async updateLogStatus(
        req: Request<{ runId: string }, {}, { status: string; log_message?: string }>,
        res: Response<ApiSuccessResponse | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { runId } = req.params;
            const { status, log_message } = req.body;

            if (!runId || !status) {
                res.status(400).json({
                    success: false,
                    error: 'Run ID and status are required',
                    statusCode: 400,
                });
                return;
            }

            // If a final log message is provided, insert it
            if (log_message) {
                // Try to get agent_id from log_sessions if it's not in n8n_logs yet
                await query(
                    `INSERT INTO n8n_logs (run_id, agent_id, log_message, status)
                     VALUES (
                        $1, 
                        COALESCE(
                            (SELECT agent_id::text FROM n8n_logs WHERE run_id = $1 LIMIT 1),
                            (SELECT agent_id::text FROM log_sessions WHERE id = $1 LIMIT 1),
                            'unknown'
                        ), 
                        $2, 
                        $3
                     )`,
                    [runId, log_message, status]
                );
            }

            logger.info('N8n log status updated:', { runId, status });

            res.status(200).json({
                success: true,
                message: 'Log status updated successfully',
            });
        } catch (error) {
            logger.error('Error updating n8n log status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update log status',
                statusCode: 500,
            });
        }
    }

    /**
     * Delete old logs (cleanup)
     * @route DELETE /api/n8n-logs/cleanup/:days
     */
    async cleanupOldLogs(
        req: Request<{ days: string }>,
        res: Response<ApiSuccessResponse<{ deletedCount: number }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const days = parseInt(req.params.days) || 30;

            const result = await query<{ count: number }>(
                `DELETE FROM n8n_logs 
                 WHERE created_at < NOW() - INTERVAL '${days} days'
                 RETURNING id`
            );

            const deletedCount = result.length;

            logger.info('Old n8n logs cleaned up:', { deletedCount, days });

            res.status(200).json({
                success: true,
                data: { deletedCount },
                message: `Deleted ${deletedCount} logs older than ${days} days`,
            });
        } catch (error) {
            logger.error('Error cleaning up old logs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cleanup logs',
                statusCode: 500,
            });
        }
    }
}

export const n8nLogsController = new N8nLogsController();
