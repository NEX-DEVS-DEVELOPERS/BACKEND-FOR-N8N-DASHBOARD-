import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/encryption';
import { logger } from '../utils/logger';
import { ApiErrorResponse } from '../types/api.types';

/**
 * Authentication middleware to verify JWT token
 */
export function authenticate(
    req: Request,
    res: Response<ApiErrorResponse>,
    next: NextFunction
): void {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
                statusCode: 401,
            });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const payload = verifyToken(token);

        // Attach user to request
        req.user = payload;

        next();
    } catch (error) {
        logger.warn('Authentication failed:', {
            error: error instanceof Error ? error.message : String(error),
            ip: req.ip,
        });

        res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
            statusCode: 401,
        });
    }
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export function optionalAuthenticate(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const payload = verifyToken(token);
            req.user = payload;
        }
    } catch (error) {
        // Ignore errors for optional auth
        logger.debug('Optional auth failed, continuing without user');
    }

    next();
}
