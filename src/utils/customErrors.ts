/**
 * Custom error classes for better error handling and consistent error responses
 */

/**
 * Base API Error class
 */
export class ApiError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, ApiError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends ApiError {
    constructor(message = 'Bad request') {
        super(message, 400);
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(message, 403);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(message, 404);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * 409 Conflict
 */
export class ConflictError extends ApiError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export class ValidationError extends ApiError {
    public details?: Array<{ field: string; message: string }>;

    constructor(message = 'Validation failed', details?: Array<{ field: string; message: string }>) {
        super(message, 422);
        this.details = details;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsError extends ApiError {
    constructor(message = 'Too many requests') {
        super(message, 429);
        Object.setPrototypeOf(this, TooManyRequestsError.prototype);
    }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends ApiError {
    constructor(message = 'Internal server error') {
        super(message, 500, false); // Not operational - unexpected error
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends ApiError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, 503);
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}

/**
 * Database Error
 */
export class DatabaseError extends ApiError {
    constructor(message = 'Database operation failed') {
        super(message, 500, false);
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends ApiError {
    public remainingAttempts?: number;

    constructor(message = 'Authentication failed', remainingAttempts?: number) {
        super(message, 401);
        this.remainingAttempts = remainingAttempts;
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
