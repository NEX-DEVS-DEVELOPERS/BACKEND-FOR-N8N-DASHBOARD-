import { Request, Response, NextFunction } from 'express';
import { verifyToken, hashToken } from '../utils/encryption';
import { querySingle } from '../config/database';
import { logger } from '../utils/logger';
import { ApiErrorResponse } from '../types/api.types';

/**
 * Authentication middleware to verify JWT token
 */
export async function authenticate(
    req: Request,
    res: Response<ApiErrorResponse>,
    next: NextFunction
): Promise<void> {
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

        // Check if token is blacklisted
        const tokenHash = hashToken(token);
        const blacklisted = await querySingle(
            `SELECT id FROM token_blacklist WHERE token_hash = $1`,
            [tokenHash]
        );

        if (blacklisted) {
            res.status(401).json({
                success: false,
                error: 'Token has been invalidated',
                statusCode: 401,
            });
            return;
        }

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
export async function optionalAuthenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
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
