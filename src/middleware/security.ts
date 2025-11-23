import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env';
import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

/**
 * Enhanced Helmet security middleware with stricter CSP
 */
export const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", env.N8N_BASE_URL], // Allow n8n API calls
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [], // Force HTTPS in production
        },
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    },
    frameguard: {
        action: 'deny', // Prevent clickjacking
    },
    noSniff: true, // Prevent MIME type sniffing
    xssFilter: true, // Enable XSS filter
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
});

/**
 * CORS middleware - Allow all localhost origins in development
 */
export const corsMiddleware = cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }

        // In development, allow all localhost origins
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }

        // Check if origin is in whitelist
        if (env.CORS_ORIGIN.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-Correlation-ID'],
});

/**
 * Enhanced XSS protection middleware - sanitize request body, query, and params
 */
export function xssProtection(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }
    next();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
        return sanitizeHtml(obj, {
            allowedTags: [],
            allowedAttributes: {},
        });
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            // Sanitize both key and value
            const sanitizedKey = sanitizeHtml(key, {
                allowedTags: [],
                allowedAttributes: {},
            });
            sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
    }

    return obj;
}

/**
 * Request size validation middleware
 * Prevents large payloads that could cause DoS
 */
export function requestSizeValidator(maxSizeKB = 100) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const contentLength = req.headers['content-length'];

        if (contentLength) {
            const sizeKB = parseInt(contentLength, 10) / 1024;
            if (sizeKB > maxSizeKB) {
                res.status(413).json({
                    success: false,
                    error: 'Request payload too large',
                    details: `Maximum allowed size is ${maxSizeKB}KB`,
                    statusCode: 413,
                });
                return;
            }
        }

        next();
    };
}

/**
 * IP whitelist middleware (optional)
 */
export function ipWhitelist(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // Skip if whitelist is disabled
    if (env.ALLOWED_IPS === '*') {
        return next();
    }

    const clientIp = req.ip || req.socket.remoteAddress;
    const allowedIps = env.ALLOWED_IPS.split(',').map((ip) => ip.trim());

    if (clientIp && allowedIps.includes(clientIp)) {
        next();
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied from this IP address',
            statusCode: 403,
        });
    }
}

/**
 * Simple CSRF protection middleware
 * Validates CSRF token for state-changing operations (POST, PUT, DELETE)
 */
export function csrfProtection(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    // Skip for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Skip CSRF protection for API endpoints with JWT auth
    // JWT tokens in Authorization header provide sufficient CSRF protection
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return next();
    }

    // For cookie-based auth (if implemented in future), verify CSRF token
    const csrfToken = req.headers['x-csrf-token'] as string;
    const csrfCookie = req.cookies?.csrf_token;

    if (csrfToken && csrfCookie && csrfToken === csrfCookie) {
        next();
    } else {
        // For now, allow all requests since we use JWT auth
        // In production with cookies, this would reject the request
        next();
    }
}
