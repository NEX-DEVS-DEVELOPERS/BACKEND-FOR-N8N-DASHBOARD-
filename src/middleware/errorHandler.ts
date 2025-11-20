import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';

/**
 * Global error handling middleware
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response<ApiErrorResponse>,
    next: NextFunction
): void {
    // Log the error
    logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        user: req.user?.userId,
    });

    // Determine status code
    let statusCode = 500;
    let message = 'Internal server error';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
    } else if (err.name === 'UnauthorizedError' || err.message.includes('token')) {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.message.includes('not found')) {
        statusCode = 404;
        message = 'Resource not found';
    } else if (err.message.includes('duplicate') || err.message.includes('already exists')) {
        statusCode = 409;
        message = 'Resource already exists';
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        statusCode,
    });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
    req: Request,
    res: Response<ApiErrorResponse>
): void {
    logger.warn('404 Not Found:', {
        path: req.path,
        method: req.method,
        ip: req.ip,
    });

    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        statusCode: 404,
    });
}
