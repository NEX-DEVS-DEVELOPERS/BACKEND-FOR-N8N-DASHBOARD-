import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Middleware to validate Backend API Key
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
    // Skip API key check for preflight requests, health check and Polar Webhooks
    if (req.method === 'OPTIONS' || req.path === '/health' || req.path === '/api/health' || req.path === '/payments/webhook' || req.originalUrl.includes('/payments/webhook')) {
        return next();
    }

    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        logger.warn('Request missing API key:', { path: req.path, ip: req.ip });
        return res.status(401).json({
            success: false,
            error: 'API key is required'
        });
    }

    if (apiKey !== env.BACKEND_API_KEY) {
        logger.error('Invalid API key provided:', { path: req.path, ip: req.ip });
        return res.status(403).json({
            success: false,
            error: 'Invalid API key'
        });
    }

    next();
};
