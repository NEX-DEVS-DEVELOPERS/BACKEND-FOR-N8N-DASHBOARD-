import { Request, Response } from 'express';
import { chatbotService } from '../services/chatbotService';
import { query } from '../config/database';
import { logger } from '../utils/logger';

export class ChatbotController {
    /**
     * Handle chat request
     */
    async chat(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }

            const { message, history } = req.body;
            const userId = req.user.userId;

            // 1. Fetch User Plan
            const userResult = await query('SELECT plan_tier FROM users WHERE id = $1', [userId]);
            const userPlan = userResult[0]?.plan_tier || 'free';

            // 2. Process Chat via Service
            const responseText = await chatbotService.processChat(userId, userPlan, message, history);

            res.status(200).json({
                success: true,
                data: { response: responseText }
            });

        } catch (error) {
            logger.error('Chatbot Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process chat request'
            });
        }
    }

    /**
     * Get Chatbot Configuration / Welcome Message
     */
    async getConfig(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }

            const userId = req.user.userId;
            const userResult = await query('SELECT plan_tier FROM users WHERE id = $1', [userId]);
            const userPlan = userResult[0]?.plan_tier || 'free';

            const welcomeMessage = chatbotService.getWelcomeMessage(userPlan);

            res.status(200).json({
                success: true,
                data: {
                    welcomeMessage,
                    plan: userPlan
                }
            });

        } catch (error) {
            logger.error('Chatbot Config Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch chatbot config'
            });
        }
    }
}

export const chatbotController = new ChatbotController();
