import { Request, Response } from 'express';
import { query, querySingle } from '../config/database';
import { logger } from '../utils/logger';
import { socketService } from '../services/socketService';

export class AdminController {
    /**
     * Get all users with stats
     */
    async getAllUsers(req: Request, res: Response): Promise<void> {
        try {
            const users = await query(`
                SELECT 
                    u.id, u.username, u.email, u.plan_tier, u.created_at, u.updated_at,
                    (SELECT COUNT(*) FROM support_requests WHERE user_id = u.id) as support_requests_count,
                    (SELECT COUNT(*) FROM request_changes WHERE user_id = u.id) as change_requests_count,
                    udd.last_updated as last_activity
                FROM users u
                LEFT JOIN user_dashboard_data udd ON u.id = udd.user_id
                ORDER BY u.created_at DESC
            `);

            res.status(200).json({
                success: true,
                data: users
            });
        } catch (error) {
            logger.error('Get all users error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch users' });
        }
    }

    /**
     * Get user details
     */
    async getUserDetails(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;
            const user = await querySingle(`
                SELECT id, username, email, plan_tier, created_at
                FROM users WHERE id = $1
            `, [userId]);

            if (!user) {
                res.status(404).json({ success: false, error: 'User not found' });
                return;
            }

            const supportRequests = await query(`
                SELECT * FROM support_requests WHERE user_id = $1 ORDER BY submitted_at DESC
            `, [userId]);

            const changeRequests = await query(`
                SELECT * FROM request_changes WHERE user_id = $1 ORDER BY submitted_at DESC
            `, [userId]);

            const dashboardData = await querySingle(`
                SELECT * FROM user_dashboard_data WHERE user_id = $1
            `, [userId]);

            res.status(200).json({
                success: true,
                data: {
                    user,
                    supportRequests,
                    changeRequests,
                    dashboardData
                }
            });
        } catch (error) {
            logger.error('Get user details error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch user details' });
        }
    }

    /**
     * Get all support requests
     */
    async getAllSupportRequests(req: Request, res: Response): Promise<void> {
        try {
            const requests = await query(`
                SELECT sr.*, u.username, u.email 
                FROM support_requests sr
                JOIN users u ON sr.user_id = u.id
                ORDER BY sr.submitted_at DESC
            `);
            res.status(200).json({ success: true, data: requests });
        } catch (error) {
            logger.error('Get support requests error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch support requests' });
        }
    }

    /**
     * Get all change requests
     */
    async getAllChangeRequests(req: Request, res: Response): Promise<void> {
        try {
            const requests = await query(`
                SELECT rc.*, u.username, u.email
                FROM request_changes rc
                JOIN users u ON rc.user_id = u.id
                ORDER BY rc.submitted_at DESC
            `);
            res.status(200).json({ success: true, data: requests });
        } catch (error) {
            logger.error('Get change requests error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch change requests' });
        }
    }

    /**
     * Mark support request as complete
     */
    async markSupportRequestComplete(req: Request, res: Response): Promise<void> {
        try {
            const { requestId } = req.params;
            const { userId } = req.body; // Pass userId for optimization, or fetch it

            // Update request status
            await query(`
                UPDATE support_requests 
                SET status = 'completed', resolved_at = NOW() 
                WHERE id = $1
            `, [requestId]);

            // Update user dashboard data (stop timer, etc.)
            await query(`
                INSERT INTO user_dashboard_data (user_id, support_timer, last_updated)
                VALUES ($1, 0, NOW())
                ON CONFLICT (user_id) 
                DO UPDATE SET support_timer = 0, last_updated = NOW()
            `, [userId]);

            // Notify user via WebSocket
            socketService.emitToUser(userId, 'dashboard_update', {
                type: 'support_completed',
                requestId,
                message: 'Your support request has been resolved!'
            });

            res.status(200).json({ success: true, message: 'Support request marked as complete' });
        } catch (error) {
            logger.error('Mark support request complete error:', error);
            res.status(500).json({ success: false, error: 'Failed to update request' });
        }
    }

    /**
     * Mark change request as complete
     */
    async markChangeRequestComplete(req: Request, res: Response): Promise<void> {
        try {
            const { requestId } = req.params;
            const { userId } = req.body;

            // Update request status
            await query(`
                UPDATE request_changes 
                SET status = 'completed'
                WHERE id = $1
            `, [requestId]);

            // Notify user via WebSocket
            socketService.emitToUser(userId, 'dashboard_update', {
                type: 'change_completed',
                requestId,
                message: 'Your requested change has been completed!'
            });

            res.status(200).json({ success: true, message: 'Change request marked as complete' });
        } catch (error) {
            logger.error('Mark change request complete error:', error);
            res.status(500).json({ success: false, error: 'Failed to update request' });
        }
    }

    /**
     * Update user dashboard data manually
     */
    async updateUserDashboard(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;
            const { supportTimer, securityCheck } = req.body;

            // Construct the full upsert query (simplified for now as we mostly update)
            await query(`
                INSERT INTO user_dashboard_data (user_id, support_timer, security_audits_last_check, last_updated)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id) 
                DO UPDATE SET support_timer = EXCLUDED.support_timer, security_audits_last_check = EXCLUDED.security_audits_last_check, last_updated = NOW()
            `, [userId, supportTimer || 0, securityCheck ? new Date() : null]);

            // Notify user
            socketService.emitToUser(userId, 'dashboard_update', {
                type: 'dashboard_refreshed',
                data: { supportTimer, securityCheck }
            });

            res.status(200).json({ success: true, message: 'Dashboard data updated' });
        } catch (error) {
            logger.error('Update dashboard data error:', error);
            res.status(500).json({ success: false, error: 'Failed to update dashboard data' });
        }
    }
    /**
     * Get dashboard stats
     */
    async getDashboardStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await querySingle(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM support_requests WHERE status = 'pending') as pending_support,
                    (SELECT COUNT(*) FROM request_changes WHERE status = 'pending') as pending_changes
            `);

            // Fetch recent activity (last 5 items from support and change requests)
            const recentSupport = await query(`
                SELECT 'support' as type, u.username, sr.submitted_at as created_at
                FROM support_requests sr
                JOIN users u ON sr.user_id = u.id
                ORDER BY sr.submitted_at DESC
                LIMIT 5
            `);

            const recentChanges = await query(`
                SELECT 'change' as type, u.username, rc.submitted_at as created_at
                FROM request_changes rc
                JOIN users u ON rc.user_id = u.id
                ORDER BY rc.submitted_at DESC
                LIMIT 5
            `);

            // Combine and sort
            const recentActivity = [...recentSupport, ...recentChanges]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5);

            res.status(200).json({
                success: true,
                data: {
                    totalUsers: parseInt(stats.total_users),
                    pendingSupport: parseInt(stats.pending_support),
                    pendingChanges: parseInt(stats.pending_changes),
                    systemUptime: '99.9%', // Placeholder for now
                    recentActivity
                }
            });
        } catch (error) {
            logger.error('Get dashboard stats error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
        }
    }
}

export const adminController = new AdminController();
