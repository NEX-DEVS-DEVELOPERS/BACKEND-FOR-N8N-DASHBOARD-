import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * API Key Authentication Middleware
 * Validates API key from n8n webhooks
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        const expectedApiKey = process.env.N8N_API_KEY || 'your-secure-api-key-here';

        if (!apiKey) {
            logger.warn('API key missing in request');
            res.status(401).json({
                success: false,
                error: 'API key is required',
                statusCode: 401,
            });
            return;
        }

        if (apiKey !== expectedApiKey) {
            logger.warn('Invalid API key provided');
            res.status(403).json({
                success: false,
                error: 'Invalid API key',
                statusCode: 403,
            });
            return;
        }

        next();
    } catch (error) {
        logger.error('Error in API key authentication:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed',
            statusCode: 500,
        });
    }
};
