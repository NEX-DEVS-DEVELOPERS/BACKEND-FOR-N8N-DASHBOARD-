import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env';
import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

/**
 * Helmet security middleware with custom configuration
 */
export const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
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
    allowedHeaders: ['Content-Type', 'Authorization'],
});

/**
 * XSS protection middleware - sanitize request body
 */
export function xssProtection(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (req.body) {
        req.body = sanitizeObject(req.body);
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
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }

    return obj;
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
        });
    }
}
