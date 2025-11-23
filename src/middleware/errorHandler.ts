import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/customErrors';
import { randomUUID } from 'crypto';

/**
 * Generate correlation ID for request tracking
 */
export function correlationIdMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const correlationId = randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
}

/**
 * Sanitize error stack trace for production
 */
function sanitizeStackTrace(stack?: string, isProduction = false): string | undefined {
    if (!stack || isProduction) {
        return undefined;
    }

    // Remove sensitive paths and replace with generic paths
    return stack
        .split('\n')
        .map(line => line.replace(/\/.*\/backend\/src\//g, '/app/src/'))
        .join('\n');
}

/**
 * Enhanced global error handling middleware
 */
export function errorHandler(
    err: Error | ApiError,
    req: Request,
    res: Response<ApiErrorResponse>
): void {
    const correlationId = req.headers['x-correlation-id'] as string;
    const isProduction = process.env.NODE_ENV === 'production';

    // Log the error with correlation ID
    logger.error('Error occurred:', {
        correlationId,
        error: err.message,
        stack: sanitizeStackTrace(err.stack, isProduction),
        path: req.path,
        method: req.method,
        ip: req.ip,
        user: req.user?.userId,
    });

    // Handle custom API errors
    if (err instanceof ApiError) {
        const response: ApiErrorResponse = {
            success: false,
            error: err.message,
            statusCode: err.statusCode,
            correlationId,
        };

        // Add details for validation errors
        if ('details' in err && err.details) {
            response.details = err.details;
        }

        // Add remaining attempts for authentication errors
        if ('remainingAttempts' in err && typeof err.remainingAttempts === 'number') {
            response.details = {
                remainingAttempts: err.remainingAttempts,
            };
        }

        res.status(err.statusCode).json(response);
        return;
    }

    // Handle standard errors
    let statusCode = 500;
    let message = 'Internal server error';

    // Determine status code and message based on error
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

    // Never expose sensitive information in production
    const errorResponse: ApiErrorResponse = {
        success: false,
        error: message,
        statusCode,
        correlationId,
    };

    // Only show error details in development
    if (!isProduction && err.message) {
        errorResponse.details = err.message;
    }

    res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
    req: Request,
    res: Response<ApiErrorResponse>
): void {
    const correlationId = req.headers['x-correlation-id'] as string;

    logger.warn('404 Not Found:', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });

    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        statusCode: 404,
        correlationId,
    });
}
