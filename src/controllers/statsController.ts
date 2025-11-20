import { Request, Response } from 'express';
import { query } from '../config/database';
import { AgentStatus } from '../types/agent.types';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';

/**
 * Stats Controller
 */
export class StatsController {
    /**
     * Get dashboard statistics
     */
    async getDashboardStats(
        req: Request,
        res: Response<ApiSuccessResponse<any> | ApiErrorResponse>
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

            const userId = req.user.userId;

            // Get agent counts
            const totalAgents = await query<{ count: number }>(
                `SELECT COUNT(*)::int as count FROM agents WHERE user_id = $1`,
                [userId]
            );

            // Get status breakdown
            const statusCounts = await query<{ status: AgentStatus; count: number }>(
                `SELECT status, COUNT(*)::int as count 
         FROM agents WHERE user_id = $1 GROUP BY status`,
                [userId]
            );

            // Get recent activity (last 10 sessions)
            const recentActivity = await query(
                `SELECT id, agent_name as "agentName", status, 
                started_at as "startedAt", completed_at as "completedAt"
         FROM log_sessions WHERE user_id = $1 
         ORDER BY started_at DESC LIMIT 10`,
                [userId]
            );

            const stats = {
                totalAgents: totalAgents[0]?.count || 0,
                statusCounts: Object.fromEntries(
                    statusCounts.map((s) => [s.status, s.count])
                ),
                recentActivity,
            };

            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (error) {
            logger.error('Error fetching dashboard stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch dashboard statistics',
                statusCode: 500,
            });
        }
    }

    /**
     * Get support usage statistics
     */
    async getSupportUsage(
        req: Request,
        res: Response<ApiSuccessResponse<any> | ApiErrorResponse>
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

            const userId = req.user.userId;

            // Get current week's start date (Sunday)
            const getWeekStart = () => {
                const now = new Date();
                const day = now.getDay();
                const diff = now.getDate() - day;
                const weekStart = new Date(now.setDate(diff));
                weekStart.setHours(0, 0, 0, 0);
                return weekStart;
            };

            const weekStart = getWeekStart();

            // Count support requests this week
            const result = await query<{ count: number }>(
                `SELECT COUNT(*)::int as count FROM support_requests 
         WHERE user_id = $1 AND submitted_at >= $2`,
                [userId, weekStart]
            );

            const requestCount = result[0]?.count || 0;

            // Determine limit based on plan (from JWT payload)
            const requestLimit = req.user.planTier === 'pro' || req.user.planTier === 'enterprise'
                ? 'Unlimited'
                : 10;

            // Get next ticket expiration (2 hours from most recent request)
            const nextExpiration = await query<{ next_expiry: Date }>(
                `SELECT (submitted_at + INTERVAL '2 hours') as "next_expiry"
         FROM support_requests 
         WHERE user_id = $1 AND (submitted_at + INTERVAL '2 hours') > NOW()
         ORDER BY submitted_at DESC LIMIT 1`,
                [userId]
            );

            res.status(200).json({
                success: true,
                data: {
                    requestCount,
                    requestLimit,
                    nextResetAt: nextExpiration[0]?.next_expiry || null,
                },
            });
        } catch (error) {
            logger.error('Error fetching support usage:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch support usage',
                statusCode: 500,
            });
        }
    }
}

export const statsController = new StatsController();
