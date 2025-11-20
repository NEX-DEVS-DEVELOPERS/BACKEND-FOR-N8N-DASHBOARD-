import { Request, Response } from 'express';
import { sseManager } from '../services/sseService';
import { query } from '../config/database';
import { LogSession, LogEntry } from '../types/log.types';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';

/**
 * Log Controller
 */
export class LogController {
    /**
     * Get all log sessions for a user
     */
    async getAllSessions(
        req: Request,
        res: Response<ApiSuccessResponse<{ sessions: any[] }> | ApiErrorResponse>
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

            const sessions = await query(
                `SELECT id, agent_id as "agentId", agent_name as "agentName", 
                status, started_at as "startedAt", completed_at as "completedAt"
         FROM log_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50`,
                [req.user.userId]
            );

            res.status(200).json({
                success: true,
                data: { sessions },
            });
        } catch (error) {
            logger.error('Error fetching log sessions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch log sessions',
                statusCode: 500,
            });
        }
    }

    /**
     * Get a specific log session with logs
     */
    async getSession(
        req: Request<{ sessionId: string }>,
        res: Response<ApiSuccessResponse<{ session: any; logs: any[] }> | ApiErrorResponse>
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

            const session = await query(
                `SELECT id, agent_id as "agentId", agent_name as "agentName", 
                status, started_at as "startedAt", completed_at as "completedAt"
         FROM log_sessions WHERE id = $1 AND user_id = $2`,
                [req.params.sessionId, req.user.userId]
            );

            if (!session || session.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Session not found',
                    statusCode: 404,
                });
                return;
            }

            const logs = await query(
                `SELECT log_type as "logType", message, timestamp
         FROM log_entries WHERE session_id = $1 ORDER BY timestamp ASC`,
                [req.params.sessionId]
            );

            res.status(200).json({
                success: true,
                data: {
                    session: session[0],
                    logs,
                },
            });
        } catch (error) {
            logger.error('Error fetching log session:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch log session',
                statusCode: 500,
            });
        }
    }

    /**
     * Delete a log session
     */
    async deleteSession(
        req: Request<{ sessionId: string }>,
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

            await query(
                `DELETE FROM log_sessions WHERE id = $1 AND user_id = $2`,
                [req.params.sessionId, req.user.userId]
            );

            res.status(200).json({
                success: true,
                message: 'Log session deleted successfully',
            });
        } catch (error) {
            logger.error('Error deleting log session:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete log session',
                statusCode: 500,
            });
        }
    }

    /**
     * SSE stream endpoint
     */
    async streamLogs(
        req: Request<{ sessionId: string }>,
        res: Response
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                });
                return;
            }

            const sessionId = req.params.sessionId;

            // Verify session belongs to user
            const session = await query(
                `SELECT id FROM log_sessions WHERE id = $1 AND user_id = $2`,
                [sessionId, req.user.userId]
            );

            if (!session || session.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'Session not found',
                });
                return;
            }

            // Subscribe client to SSE stream
            sseManager.subscribe(sessionId, res);

            logger.info('Client subscribed to SSE stream:', {
                sessionId,
                userId: req.user.userId,
            });
        } catch (error) {
            logger.error('Error streaming logs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to stream logs',
            });
        }
    }
}

export const logController = new LogController();
