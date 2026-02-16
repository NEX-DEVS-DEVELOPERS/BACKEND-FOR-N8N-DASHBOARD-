import { Request, Response } from 'express';
import { query, querySingle } from '../config/database';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';

export const notificationController = {
    /**
     * Get all notifications for the current user
     */
    async getNotifications(req: Request, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const notifications = await query(
                'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
                [userId]
            );

            return res.status(200).json({
                success: true,
                data: notifications
            });
        } catch (error) {
            logger.error('Error fetching notifications:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            await query(
                'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
                [id, userId]
            );

            return res.status(200).json({ success: true, message: 'Notification marked as read' });
        } catch (error) {
            logger.error('Error marking notification as read:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(req: Request, res: Response) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            await query(
                'UPDATE notifications SET is_read = true WHERE user_id = $1',
                [userId]
            );

            return res.status(200).json({ success: true, message: 'All notifications marked as read' });
        } catch (error) {
            logger.error('Error marking all notifications as read:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    },

    /**
     * Create a notification (Internal usage mostly)
     */
    async createNotification(userId: string, title: string, message: string, type: string = 'info', metadata: any = {}) {
        try {
            const result = await querySingle(
                'INSERT INTO notifications (user_id, title, message, type, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [userId, title, message, type, JSON.stringify(metadata)]
            );

            if (result) {
                // Emit via Socket.IO for real-time update
                socketService.emitToUser(userId, 'new_notification', result);
            }

            return result;
        } catch (error) {
            logger.error('Error creating notification:', error);
            return null;
        }
    }
};
