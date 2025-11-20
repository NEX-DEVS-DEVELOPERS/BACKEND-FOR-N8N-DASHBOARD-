import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests, please try again later',
    },
});

/**
 * Authentication endpoint rate limiter (stricter)
 */
export const authLimiter = rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    message: {
        success: false,
        error: 'Too many login attempts, please try again later',
    },
});

/**
 * Form submission rate limiter (plan-based)
 */
export const formLimiter = rateLimit({
    windowMs: env.FORM_RATE_LIMIT_WINDOW_MS,
    max: async (req: Request) => {
        // Get user plan from request
        const user = req.user;
        if (!user) {
            return env.FORM_RATE_LIMIT_MAX_REQUESTS;
        }

        // Unlimited for pro/enterprise
        if (user.planTier === 'pro' || user.planTier === 'enterprise') {
            return 999999;
        }

        // Free plan limit
        return env.FORM_RATE_LIMIT_MAX_REQUESTS;
    },
    keyGenerator: (req: Request) => {
        return req.user?.userId || req.ip || 'anonymous';
    },
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            success: false,
            error: 'Form submission limit exceeded',
            details: {
                retryAfter: req.rateLimit?.resetTime,
                limit: req.rateLimit?.limit,
            },
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Webhook proxy rate limiter
 */
export const webhookLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many webhook requests, please try again later',
    },
});
