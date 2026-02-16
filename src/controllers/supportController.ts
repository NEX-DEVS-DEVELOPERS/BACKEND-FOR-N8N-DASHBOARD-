import { Request, Response } from 'express';
import { sendSupportEmail, SupportRequest } from '../services/emailService';
import { notificationController } from './notificationController';
import { query } from '../config/database';
import { logger } from '../utils/logger';

export const supportController = {
    /**
     * Handle support request submission
     */
    async submitRequest(req: Request, res: Response) {
        try {
            const { name, email, issue, specialistId } = req.body;
            const userId = req.user?.userId;

            // Basic validation
            if (!name || !issue || !specialistId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: name, issue, or specialistId'
                });
            }

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized: User ID is required'
                });
            }

            // Prepare data
            const supportData: SupportRequest = {
                name,
                email: email || 'No email provided',
                issue,
                specialistId
            };

            // **CRITICAL FIX**: Save to database FIRST
            try {
                await query(
                    `INSERT INTO support_requests (user_id, name, issue, specialist_id, status) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [userId, name, issue, specialistId, 'pending']
                );
                logger.info('Support request saved to database', { userId, specialistId });
            } catch (dbError) {
                logger.error('Failed to save support request to database:', dbError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save support request'
                });
            }

            // Send email
            await sendSupportEmail(supportData);

            // Create system notification for the user
            if (userId) {
                const specialistName = supportData.specialistId === 'ali' ? 'Ali Hasnaat' :
                    supportData.specialistId === 'hassam_faizan' ? 'Hassam & Faizan' :
                        'Usman Aftab';

                await notificationController.createNotification(
                    userId,
                    'Support Request Received',
                    `Your request for ${specialistName} has been received. Our team will assist you shortly.`,
                    'support',
                    {
                        specialistId: supportData.specialistId,
                        specialistName,
                        requestData: supportData
                    }
                );

                // Simulation: Support agent "receives" the request after 5-10 seconds
                setTimeout(async () => {
                    await notificationController.createNotification(
                        userId,
                        'Request Assigned',
                        `${specialistName} is now reviewing your support request. ETA: ${supportData.specialistId === 'ali' ? '15m' : '1h'}.`,
                        'support',
                        { specialistId: supportData.specialistId, status: 'assigned' }
                    );
                }, 8000);
            }

            return res.status(200).json({
                success: true,
                message: 'Support request sent successfully'
            });

        } catch (error) {
            console.error('Support controller error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to process support request'
            });
        }
    }
};
