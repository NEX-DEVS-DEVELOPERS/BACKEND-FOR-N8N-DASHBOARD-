import { Request, Response } from 'express';
import { query } from '../config/database';
import { n8nService } from '../services/n8nService';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Form schemas
const supportFormSchema = z.object({
    name: z.string().min(1).max(255),
    issue: z.string().min(10),
    specialistId: z.string(),
});

const contactFormSchema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    message: z.string().min(10),
});

const requestChangeFormSchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().min(10),
    priority: z.enum(['low', 'medium', 'high']).optional(),
});

/**
 * Form Controller
 */
export class FormController {
    /**
     * Submit support form
     */
    async submitSupport(
        req: Request,
        res: Response<ApiSuccessResponse<{ requestId: string }> | ApiErrorResponse>
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

            const data = supportFormSchema.parse(req.body);

            // Insert into database
            const result = await query<{ id: string }>(
                `INSERT INTO support_requests (user_id, name, issue, specialist_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
                [req.user.userId, data.name, data.issue, data.specialistId]
            );

            const requestId = result[0]?.id;

            if (!requestId) {
                throw new Error('Failed to create support request');
            }

            // TODO: Forward to n8n webhook for notification
            // This would trigger an n8n workflow to notify the specialist
            try {
                const webhookUrl = process.env.N8N_SUPPORT_FORM_WEBHOOK;
                if (webhookUrl) {
                    await n8nService.triggerWebhook(webhookUrl, {
                        type: 'support',
                        requestId,
                        name: data.name,
                        issue: data.issue,
                        specialistId: data.specialistId,
                        userId: req.user.userId,
                        timestamp: new Date().toISOString(),
                    });
                }
            } catch (error) {
                logger.warn('Failed to forward support request to n8n:', error);
                // Continue even if n8n notification fails
            }

            logger.info('Support request submitted:', {
                requestId,
                userId: req.user.userId,
                specialistId: data.specialistId,
            });

            res.status(201).json({
                success: true,
                data: { requestId },
                message: 'Support request submitted successfully',
            });
        } catch (error) {
            logger.error('Error submitting support form:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to submit support request',
                statusCode: 500,
            });
        }
    }

    /**
     * Submit contact form
     */
    async submitContact(
        req: Request,
        res: Response<ApiSuccessResponse | ApiErrorResponse>
    ): Promise<void> {
        try {
            const data = contactFormSchema.parse(req.body);

            // Insert into database
            await query(
                `INSERT INTO contact_submissions (name, email, message)
         VALUES ($1, $2, $3)`,
                [data.name, data.email, data.message]
            );

            // TODO: Forward to n8n webhook for notification
            try {
                const webhookUrl = process.env.N8N_CONTACT_FORM_WEBHOOK;
                if (webhookUrl) {
                    await n8nService.triggerWebhook(webhookUrl, {
                        type: 'contact',
                        name: data.name,
                        email: data.email,
                        message: data.message,
                        timestamp: new Date().toISOString(),
                    });
                }
            } catch (error) {
                logger.warn('Failed to forward contact form to n8n:', error);
            }

            logger.info('Contact form submitted:', { email: data.email });

            res.status(201).json({
                success: true,
                message: 'Message sent successfully',
            });
        } catch (error) {
            logger.error('Error submitting contact form:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send message',
                statusCode: 500,
            });
        }
    }

    /**
     * Submit request change form
     */
    async submitRequestChange(
        req: Request,
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

            const data = requestChangeFormSchema.parse(req.body);

            // Store in database
            await query(
                `INSERT INTO request_changes (user_id, title, description, priority)
                 VALUES ($1, $2, $3, $4)`,
                [req.user.userId, data.title, data.description, data.priority || 'medium']
            );

            // Forward to n8n

            try {
                const webhookUrl = process.env.N8N_REQUEST_CHANGE_WEBHOOK;
                if (webhookUrl) {
                    await n8nService.triggerWebhook(webhookUrl, {
                        type: 'request_change',
                        title: data.title,
                        description: data.description,
                        priority: data.priority || 'medium',
                        userId: req.user.userId,
                        username: req.user.username,
                        timestamp: new Date().toISOString(),
                    });
                }
            } catch (error) {
                logger.warn('Failed to forward request change to n8n:', error);
            }

            logger.info('Request change submitted:', {
                userId: req.user.userId,
                title: data.title,
            });

            res.status(201).json({
                success: true,
                message: 'Request submitted successfully',
            });
        } catch (error) {
            logger.error('Error submitting request change:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to submit request',
                statusCode: 500,
            });
        }
    }
}

export const formController = new FormController();
