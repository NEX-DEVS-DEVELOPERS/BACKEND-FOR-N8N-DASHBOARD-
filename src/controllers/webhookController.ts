
import { Request, Response } from 'express';
import { validateEvent } from '@polar-sh/sdk/webhooks';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { socketService } from '../services/socketService';
import { notificationController } from './notificationController';

export class WebhookController {
    /**
     * Handle Polar webhooks
     */
    async handlePolarWebhook(req: Request, res: Response): Promise<void> {
        const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

        if (!webhookSecret) {
            logger.error('POLAR_WEBHOOK_SECRET is not configured');
            res.status(500).send('Webhook secret not configured');
            return;
        }

        const payload = req.body;
        const headers = req.headers as Record<string, string>;

        try {
            // Verify and parse the event
            const rawBody = (req as any).rawBody || JSON.stringify(payload);
            const event = validateEvent(rawBody, headers, webhookSecret);

            logger.info('Received Polar webhook event:', { type: event.type });

            switch (event.type) {
                case 'checkout.created':
                    // Just logging for now
                    break;

                case 'order.created':
                case 'subscription.created':
                case 'subscription.updated':
                    await this.handleFulfillment(event);
                    break;

                default:
                    logger.info('Unhandled Polar event type:', { type: event.type });
            }

            res.status(202).json({ received: true });
        } catch (error) {
            logger.error('Polar Webhook validation failed:', error);
            res.status(401).send('Invalid signature');
        }
    }

    /**
     * Handle fulfillment for orders and subscriptions
     */
    private async handleFulfillment(event: any): Promise<void> {
        const { data } = event;
        const userId = data.customerExternalId || data.metadata?.userId;
        const productName = data.product?.name;

        if (!userId) {
            logger.warn('User ID missing in fulfillment event:', { eventId: event.id });
            return;
        }

        logger.info('Processing fulfillment for user:', { userId, productName });

        let planTier = 'free';
        let has247Addon = false;

        if (productName?.toLowerCase().includes('pro')) {
            planTier = 'pro';
        } else if (productName?.toLowerCase().includes('enterprise')) {
            planTier = 'enterprise';
            has247Addon = true;
        } else if (productName?.toLowerCase().includes('24/7')) {
            has247Addon = true;
            // If they bought the addon, we should also check their current plan
            // But usually this happens alongside a plan or on top of Pro
        }

        try {
            if (productName?.toLowerCase().includes('24/7')) {
                await query(
                    `UPDATE users SET has_247_addon = true, updated_at = NOW() WHERE id = $1`,
                    [userId]
                );
            } else {
                await query(
                    `UPDATE users SET plan_tier = $1, has_247_addon = $2, updated_at = NOW() WHERE id = $3`,
                    [planTier, has247Addon, userId]
                );
            }
            logger.info('User dashboard updated successfully via webhook');

            // Emit update to user via WebSocket
            socketService.emitToUser(userId, 'dashboard_update', {
                type: 'plan_update',
                planTier,
                has247Addon,
                timestamp: new Date().toISOString()
            });
            logger.info('Emitted dashboard_update via WebSocket');

            // Send system notification
            await notificationController.createNotification(
                userId,
                'Plan Activated',
                `Your ${productName || planTier} plan has been successfully activated! Enjoy your new features.`,
                'success',
                { productName, planTier, has247Addon }
            );

        } catch (error) {
            logger.error('Failed to update user via webhook:', error);
        }
    }
}

export const webhookController = new WebhookController();
