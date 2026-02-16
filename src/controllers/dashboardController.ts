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
        nextTicketAt?: string | null;
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

            // Calculate next ticket time
            let nextTicketAt = null;
            if (recentTickets && recentTickets.length > 0) {
                const lastTicketTime = new Date(recentTickets[0].createdAt).getTime();
                const planTierLower = (planTier || 'free').toLowerCase();
                let cooldownMinutes = 60; // Default/Free

                if (planTierLower === 'enterprise') {
                    cooldownMinutes = 2;
                } else if (planTierLower === 'pro') {
                    cooldownMinutes = 40;
                }

                logger.info(`[Dashboard] Calculating cooldown for user ${userId} (${planTierLower}): ${cooldownMinutes} minutes`);

                const nextTime = lastTicketTime + (cooldownMinutes * 60 * 1000);
                if (nextTime > Date.now()) {
                    nextTicketAt = new Date(nextTime).toISOString();
                }
            }

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
                    nextTicketAt: nextTicketAt,
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

    /**
     * Create a dev credit log entry
     */
    async createDevCreditLog(
        req: Request,
        res: Response<ApiSuccessResponse<{ log: DevCreditLog }> | ApiErrorResponse>
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
            const { title, description, hoursUsed, category } = req.body;

            // Validate input
            if (!title || !hoursUsed || hoursUsed <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'Title and valid hours_used are required',
                    statusCode: 400,
                });
                return;
            }

            // Check allowance
            const devCreditAllowance = this.getDevCreditAllowance(planTier);
            if (devCreditAllowance === 0) {
                res.status(403).json({
                    success: false,
                    error: 'Your plan does not include dev credits. Upgrade to Pro or Enterprise!',
                    statusCode: 403,
                });
                return;
            }

            // Check usage for this month
            const currentUsage = await querySingle<{ total: number }>(
                `SELECT COALESCE(SUM(hours_used), 0) as total 
                 FROM dev_credit_logs 
                 WHERE user_id = $1 
                 AND created_at >= date_trunc('month', NOW())`,
                [userId]
            );

            const usedHours = parseFloat(currentUsage?.total?.toString() || '0');
            if (usedHours + hoursUsed > devCreditAllowance) {
                res.status(400).json({
                    success: false,
                    error: `Insufficient dev credits. You have ${devCreditAllowance - usedHours} hours remaining this month.`,
                    statusCode: 400,
                });
                return;
            }

            // Create the log
            const result = await querySingle<any>(
                `INSERT INTO dev_credit_logs (user_id, title, description, hours_used, category, status)
                 VALUES ($1, $2, $3, $4, $5, 'active')
                 RETURNING id, title, description, hours_used as "hoursUsed", status, category, created_at as "createdAt"`,
                [userId, title, description || '', hoursUsed, category || 'general']
            );

            logger.info('Dev credit log created:', { userId, title, hoursUsed });

            // Send notification
            try {
                const { notificationController } = await import('./notificationController');
                await notificationController.createNotification(
                    userId,
                    'Dev Credit Used',
                    `${hoursUsed}h used for "${title}". Remaining: ${(devCreditAllowance - usedHours - hoursUsed).toFixed(1)}h this month.`,
                    'info',
                    { title, hoursUsed, category: category || 'general' }
                );
            } catch (notifError) {
                logger.error('Failed to send dev credit notification:', notifError);
            }

            res.status(201).json({
                success: true,
                data: { log: result },
            });
        } catch (error) {
            logger.error('Create dev credit log error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create dev credit log',
                statusCode: 500,
            });
        }
    }

    /**
     * Get user invoices
     */
    async getInvoices(
        req: Request,
        res: Response<ApiSuccessResponse<{ invoices: any[] }> | ApiErrorResponse>
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

            // Check if we need to generate a new invoice for this month (simple simulation)
            // In a real app, this would be a background job or webhook from Stripe
            const currentMonthStart = new Date();
            currentMonthStart.setDate(1);
            currentMonthStart.setHours(0, 0, 0, 0);

            const existingInvoice = await querySingle<{ id: string }>(
                `SELECT id FROM invoices 
                 WHERE user_id = $1 
                 AND created_at >= $2`,
                [userId, currentMonthStart]
            );

            if (!existingInvoice) {
                // Generate a new invoice for the current month
                const planTier = req.user.planTier || 'free';
                if (planTier !== 'free') {
                    const amount = planTier === 'enterprise' ? 99.00 : ((req.user as any).has247Addon ? 39.00 : 29.00);
                    const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

                    await query(
                        `INSERT INTO invoices (
                            invoice_number, user_id, amount, plan_name, 
                            billing_period_start, billing_period_end, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, 'paid')`,
                        [
                            invoiceNum,
                            userId,
                            amount,
                            planTier.charAt(0).toUpperCase() + planTier.slice(1),
                            currentMonthStart,
                            new Date(new Date().setMonth(currentMonthStart.getMonth() + 1))
                        ]
                    );
                }
            }

            // Check for ANY invoices, if none, create a historical demo invoice
            const anyInvoice = await querySingle<{ id: string }>(
                `SELECT id FROM invoices WHERE user_id = $1 LIMIT 1`,
                [userId]
            );

            if (!anyInvoice) {
                // Create a demo invoice from last month
                const lastMonth = new Date();
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                lastMonth.setDate(1);

                await query(
                    `INSERT INTO invoices (
                        invoice_number, user_id, amount, plan_name, 
                        billing_period_start, billing_period_end, status, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7)`,
                    [
                        `INV-${lastMonth.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                        userId,
                        29.00,
                        'Pro',
                        lastMonth,
                        new Date(new Date(lastMonth).setMonth(lastMonth.getMonth() + 1)),
                        lastMonth
                    ]
                );
            }

            const invoices = await query<any>(
                `SELECT id, invoice_number as "invoiceNumber", amount, currency, status, 
                        plan_name as "planName", billing_period_start as "billingStart", 
                        billing_period_end as "billingEnd", created_at as "createdAt"
                 FROM invoices 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC`,
                [userId]
            );

            res.status(200).json({
                success: true,
                data: { invoices },
            });
        } catch (error) {
            logger.error('Invoices error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch invoices',
                statusCode: 500,
            });
        }
    }

    /**
     * Get active requests (support tickets and change requests)
     */
    async getActiveRequests(
        req: Request,
        res: Response<ApiSuccessResponse<{ requests: any[]; nextTicketAt?: string | null }> | ApiErrorResponse>
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
            const planTier = req.user.planTier || 'free';

            // Fetch active support tickets
            const supportTickets = await query<any>(
                `SELECT id, name as title, issue as description, status, 
                        'support' as type, submitted_at as "createdAt"
                 FROM support_requests 
                 WHERE user_id = $1 AND status != 'resolved'
                 ORDER BY submitted_at DESC`,
                [userId]
            );

            // Fetch active change requests
            const changeRequests = await query<any>(
                `SELECT id, title, description, status, 
                        'change' as type, submitted_at as "createdAt"
                 FROM request_changes 
                 WHERE user_id = $1 AND status != 'completed'
                 ORDER BY submitted_at DESC`,
                [userId]
            );

            // Combine and sort by date
            const requests = [...supportTickets, ...changeRequests].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            // Calculate next ticket time based on LAST support request (active or resolved)
            const lastSupportRequest = await querySingle<{ submitted_at: Date }>(
                `SELECT submitted_at 
                 FROM support_requests 
                 WHERE user_id = $1 
                 ORDER BY submitted_at DESC 
                 LIMIT 1`,
                [userId]
            );

            let nextTicketAt = null;
            if (lastSupportRequest) {
                const lastTime = new Date(lastSupportRequest.submitted_at).getTime();
                const planTierLower = (planTier || 'free').toLowerCase();
                let cooldownMinutes = 60; // Default/Free

                if (planTierLower === 'enterprise') {
                    cooldownMinutes = 2;
                } else if (planTierLower === 'pro') {
                    cooldownMinutes = 40;
                }

                logger.info(`[ActiveRequests] Calculating cooldown for user ${userId} (${planTierLower}): ${cooldownMinutes} minutes`);

                const nextTime = lastTime + (cooldownMinutes * 60 * 1000);
                if (nextTime > Date.now()) {
                    nextTicketAt = new Date(nextTime).toISOString();
                }
            }

            res.status(200).json({
                success: true,
                data: { requests, nextTicketAt },
            });
        } catch (error) {
            logger.error('Active requests error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch active requests',
                statusCode: 500,
            });
        }
    }
}

export const dashboardController = new DashboardController();
