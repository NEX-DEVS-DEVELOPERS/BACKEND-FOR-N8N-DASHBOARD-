import { Request, Response } from 'express';
import { query, querySingle } from '../config/database';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';

/**
 * Dashboard Controller
 * Handles all dashboard-related data aggregation and retrieval
 */

interface DevCreditLog {
    id: string;
    title: string;
    description: string;
    hoursUsed: number;
    status: string;
    category: string;
    createdAt: string;
    completedAt: string | null;
}

interface ChangelogEntry {
    id: string;
    title: string;
    description: string;
    category: string;
    version: string;
    createdAt: string;
}

interface ActivityEntry {
    id: string;
    action: string;
    description: string;
    metadata: Record<string, any>;
    createdAt: string;
}

interface SupportTicketSummary {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
}

interface DashboardOverview {
    devCredits: {
        totalHours: number;
        usedHours: number;
        remainingHours: number;
        recentLogs: DevCreditLog[];
    };
    support: {
        openTickets: number;
        resolvedTickets: number;
        recentTickets: SupportTicketSummary[];
    };
    changelog: ChangelogEntry[];
    activity: ActivityEntry[];
    systemStatus: {
        uptime: string;
        lastHealthCheck: string;
        securityStatus: string;
    };
}

export class DashboardController {
    /**
     * Get complete dashboard overview
     */
    async getOverview(
        req: Request,
        res: Response<ApiSuccessResponse<DashboardOverview> | ApiErrorResponse>
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
            const planTier = req.user.planTier;

            // Get dev credit allowance based on plan
            const devCreditAllowance = this.getDevCreditAllowance(planTier);

            // Get dev credit usage
            const devCreditsUsed = await querySingle<{ total: number }>(
                `SELECT COALESCE(SUM(hours_used), 0) as total 
                 FROM dev_credit_logs 
                 WHERE user_id = $1 
                 AND created_at >= date_trunc('month', NOW())`,
                [userId]
            );

            // Get recent dev credit logs
            const recentDevLogs = await query<any>(
                `SELECT id, title, description, hours_used as "hoursUsed", 
                        status, category, created_at as "createdAt", 
                        completed_at as "completedAt"
                 FROM dev_credit_logs 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 5`,
                [userId]
            );

            // Get support ticket counts
            const openTickets = await querySingle<{ count: number }>(
                `SELECT COUNT(*) as count 
                 FROM support_requests 
                 WHERE user_id = $1 AND status IN ('pending', 'in_progress')`,
                [userId]
            );

            const resolvedTickets = await querySingle<{ count: number }>(
                `SELECT COUNT(*) as count 
                 FROM support_requests 
                 WHERE user_id = $1 AND status = 'resolved'`,
                [userId]
            );

            // Get recent support tickets
            const recentTickets = await query<any>(
                `SELECT id, name as subject, status, 
                        COALESCE(specialist_id, 'normal') as priority,
                        submitted_at as "createdAt"
                 FROM support_requests 
                 WHERE user_id = $1 
                 ORDER BY submitted_at DESC 
                 LIMIT 5`,
                [userId]
            );

            // Get changelog entries (public only)
            const changelog = await query<any>(
                `SELECT id, title, description, category, version, 
                        created_at as "createdAt"
                 FROM changelog_entries 
                 WHERE is_public = true 
                 ORDER BY created_at DESC 
                 LIMIT 10`
            );

            // Get user activity
            const activity = await query<any>(
                `SELECT id, action, description, metadata, 
                        created_at as "createdAt"
                 FROM user_activity_log 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 10`,
                [userId]
            );

            const usedHours = parseFloat(devCreditsUsed?.total?.toString() || '0');

            const overview: DashboardOverview = {
                devCredits: {
                    totalHours: devCreditAllowance,
                    usedHours: usedHours,
                    remainingHours: Math.max(0, devCreditAllowance - usedHours),
                    recentLogs: recentDevLogs,
                },
                support: {
                    openTickets: parseInt(openTickets?.count?.toString() || '0'),
                    resolvedTickets: parseInt(resolvedTickets?.count?.toString() || '0'),
                    recentTickets: recentTickets.map((t: any) => ({
                        id: t.id,
                        subject: t.subject,
                        status: t.status,
                        priority: t.priority,
                        createdAt: t.createdAt,
                    })),
                },
                changelog: changelog,
                activity: activity,
                systemStatus: {
                    uptime: '99.99%',
                    lastHealthCheck: new Date().toISOString(),
                    securityStatus: 'passed',
                },
            };

            res.status(200).json({
                success: true,
                data: overview,
            });
        } catch (error) {
            logger.error('Dashboard overview error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch dashboard data',
                statusCode: 500,
            });
        }
    }

    /**
     * Get dev credit history
     */
    async getDevCredits(
        req: Request,
        res: Response<ApiSuccessResponse<{ logs: DevCreditLog[]; summary: any }> | ApiErrorResponse>
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
            const planTier = req.user.planTier;

            const logs = await query<any>(
                `SELECT id, title, description, hours_used as "hoursUsed", 
                        status, category, created_at as "createdAt", 
                        completed_at as "completedAt"
                 FROM dev_credit_logs 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 20`,
                [userId]
            );

            const totalUsed = await querySingle<{ total: number }>(
                `SELECT COALESCE(SUM(hours_used), 0) as total 
                 FROM dev_credit_logs 
                 WHERE user_id = $1 
                 AND created_at >= date_trunc('month', NOW())`,
                [userId]
            );

            const devCreditAllowance = this.getDevCreditAllowance(planTier);
            const usedHours = parseFloat(totalUsed?.total?.toString() || '0');

            res.status(200).json({
                success: true,
                data: {
                    logs: logs,
                    summary: {
                        totalHours: devCreditAllowance,
                        usedHours: usedHours,
                        remainingHours: Math.max(0, devCreditAllowance - usedHours),
                    },
                },
            });
        } catch (error) {
            logger.error('Dev credits error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch dev credits',
                statusCode: 500,
            });
        }
    }

    /**
     * Get changelog entries
     */
    async getChangelog(
        req: Request,
        res: Response<ApiSuccessResponse<{ entries: ChangelogEntry[] }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;

            const entries = await query<any>(
                `SELECT id, title, description, category, version, 
                        created_at as "createdAt"
                 FROM changelog_entries 
                 WHERE is_public = true 
                 ORDER BY created_at DESC 
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );

            res.status(200).json({
                success: true,
                data: { entries },
            });
        } catch (error) {
            logger.error('Changelog error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch changelog',
                statusCode: 500,
            });
        }
    }

    /**
     * Get user activity log
     */
    async getActivity(
        req: Request,
        res: Response<ApiSuccessResponse<{ activity: ActivityEntry[] }> | ApiErrorResponse>
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
            const limit = parseInt(req.query.limit as string) || 20;

            const activity = await query<any>(
                `SELECT id, action, description, metadata, 
                        created_at as "createdAt"
                 FROM user_activity_log 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [userId, limit]
            );

            res.status(200).json({
                success: true,
                data: { activity },
            });
        } catch (error) {
            logger.error('Activity log error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch activity',
                statusCode: 500,
            });
        }
    }

    /**
     * Log user activity
     */
    async logActivity(
        userId: string,
        action: string,
        description: string,
        metadata: Record<string, any> = {},
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        try {
            await query(
                `INSERT INTO user_activity_log (user_id, action, description, metadata, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [userId, action, description, JSON.stringify(metadata), ipAddress, userAgent]
            );
        } catch (error) {
            logger.error('Failed to log activity:', error);
        }
    }

    /**
     * Get dev credit allowance based on plan tier
     */
    private getDevCreditAllowance(planTier: string): number {
        switch (planTier) {
            case 'enterprise':
                return 15;
            case 'pro':
                return 3;
            default:
                return 0;
        }
    }
}

export const dashboardController = new DashboardController();
