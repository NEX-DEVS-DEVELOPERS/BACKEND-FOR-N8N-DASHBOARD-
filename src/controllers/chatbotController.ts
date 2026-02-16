import { Request, Response } from 'express';
import { chatbotService } from '../services/chatbotService';
import { secureChatStorage } from '../services/secureChatStorage';
import { query } from '../config/database';
import { logger } from '../utils/logger';

export class ChatbotController {
    /**
     * Handle chat request with streaming
     */
    async chat(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }

            const { messages } = req.body; // Expecting 'messages' array from Vercel AI SDK
            const userId = req.user.userId;

            // 1. Fetch User Plan
            const userResult = await query('SELECT plan_tier FROM users WHERE id = $1', [userId]);
            const userPlan = userResult[0]?.plan_tier || 'free';

            // 2. Process Chat via Service (Returns a Stream)
            const result = await chatbotService.createChatStream(userId, userPlan, messages);

            if (!result) {
                throw new Error('Failed to create chat stream');
            }

            // 3. Set headers for streaming text
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // 4. Pipe the text stream to the response
            // For Express/Node.js, use the textStream property directly
            const stream = result.textStream;

            try {
                for await (const chunk of stream) {
                    res.write(chunk);
                }
                res.end();
            } catch (streamError) {
                logger.error('Stream piping error:', streamError);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Stream error occurred'
                    });
                } else {
                    res.end();
                }
            }

            // Note: Saving to secure storage is handled in the onFinish callback of the stream in the service

        } catch (error) {
            logger.error('Chatbot Error:', error);
            // If headers haven't been sent, send JSON error
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to process chat request'
                });
            }
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

    /**
     * Get user's chat sessions (only those with actual user messages)
     */
    async getSessions(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }

            const userId = req.user.userId;
            const userResult = await query('SELECT plan_tier FROM users WHERE id = $1', [userId]);
            const userPlan = userResult[0]?.plan_tier || 'free';

            const sessions = await secureChatStorage.getUserSessions(userId, userPlan);

            res.status(200).json({
                success: true,
                data: { sessions }
            });

        } catch (error) {
            logger.error('Get Sessions Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch chat sessions'
            });
        }
    }

    /**
     * Load a specific session's messages
     */
    async loadSession(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }

            const { sessionId } = req.params;
            const userId = req.user.userId;

            const messages = await secureChatStorage.loadChatMemory(sessionId, userId);

            res.status(200).json({
                success: true,
                data: { messages }
            });

        } catch (error) {
            logger.error('Load Session Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to load chat session'
            });
        }
    }

    /**
     * Delete a session
     */
    async deleteSession(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }

            const { sessionId } = req.params;
            const userId = req.user.userId;

            const success = await secureChatStorage.deleteSession(sessionId, userId);

            res.status(200).json({
                success,
                data: { deleted: success }
            });

        } catch (error) {
            logger.error('Delete Session Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete chat session'
            });
        }
    }

    /**
     * Create a new chat session
     */
    async createSession(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, error: 'Unauthorized' });
                return;
            }

            const userId = req.user.userId;
            const userResult = await query('SELECT plan_tier FROM users WHERE id = $1', [userId]);
            const userPlan = userResult[0]?.plan_tier || 'free';

            const session = await secureChatStorage.createSession(userId, userPlan);
            const welcomeMessage = chatbotService.getWelcomeMessage(userPlan);

            res.status(200).json({
                success: true,
                data: {
                    session,
                    welcomeMessage
                }
            });

        } catch (error) {
            logger.error('Create Session Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create chat session'
            });
        }
    }
}

export const chatbotController = new ChatbotController();
