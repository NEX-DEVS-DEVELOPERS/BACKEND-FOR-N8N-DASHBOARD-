import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { PlanTier } from '../types/user.types';
import { logger } from '../utils/logger';

/**
 * Rate limit configuration by plan tier
 */
interface PlanRateLimits {
    hourlyLimit: number;
    minuteLimit: number;
}

const PLAN_LIMITS: Record<PlanTier, PlanRateLimits> = {
    free: {
        hourlyLimit: parseInt(process.env.CHATBOT_FREE_HOURLY_LIMIT || '20'),
        minuteLimit: parseInt(process.env.CHATBOT_FREE_MINUTE_LIMIT || '5')
    },
    pro: {
        hourlyLimit: parseInt(process.env.CHATBOT_PRO_HOURLY_LIMIT || '100'),
        minuteLimit: parseInt(process.env.CHATBOT_PRO_MINUTE_LIMIT || '20')
    },
    enterprise: {
        hourlyLimit: parseInt(process.env.CHATBOT_ENTERPRISE_HOURLY_LIMIT || '0'), // 0 = unlimited
        minuteLimit: parseInt(process.env.CHATBOT_ENTERPRISE_MINUTE_LIMIT || '0') // 0 = unlimited
    }
};

/**
 * Custom key generator based on user ID
 */
const getUserKeyGenerator = (req: Request): string => {
    // Extract user from auth middleware
    const user = (req as any).user;
    return user ? `chatbot_${user.id}` : `chatbot_ip_${req.ip}`;
};

/**
 * Hourly rate limiter factory
 */
export const createHourlyLimiter = (plan: PlanTier) => {
    const limits = PLAN_LIMITS[plan];

    // Enterprise has no limits
    if (limits.hourlyLimit === 0) {
        return (req: Request, res: Response, next: NextFunction) => next();
    }

    return rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: limits.hourlyLimit,
        message: {
            error: 'Too many chatbot requests',
            message: `${plan.toUpperCase()} plan limit: ${limits.hourlyLimit} requests per hour. Please wait before trying again.`,
            retryAfter: 'Check Retry-After header'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getUserKeyGenerator,
        handler: (req, res) => {
            logger.warn(`Chatbot hourly rate limit exceeded for user: ${(req as any).user?.id || req.ip} (plan: ${plan})`);
            res.status(429).json({
                error: 'Too many chatbot requests',
                message: `${plan.toUpperCase()} plan limit: ${limits.hourlyLimit} requests per hour. Please wait before trying again.`,
                plan,
                limit: limits.hourlyLimit,
                window: '1 hour',
                upgradeMessage: plan === 'free'
                    ? 'Upgrade to Pro for 100 requests/hour or Enterprise for unlimited requests.'
                    : plan === 'pro'
                        ? 'Upgrade to Enterprise for unlimited requests.'
                        : undefined
            });
        }
    });
};

/**
 * Minute rate limiter factory (prevents burst abuse)
 */
export const createMinuteLimiter = (plan: PlanTier) => {
    const limits = PLAN_LIMITS[plan];

    // Enterprise has no limits
    if (limits.minuteLimit === 0) {
        return (req: Request, res: Response, next: NextFunction) => next();
    }

    return rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: limits.minuteLimit,
        message: {
            error: 'Too many requests in a short time',
            message: `Please slow down. ${plan.toUpperCase()} plan limit: ${limits.minuteLimit} requests per minute.`
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getUserKeyGenerator,
        skipSuccessfulRequests: false,
        handler: (req, res) => {
            logger.warn(`Chatbot minute rate limit exceeded for user: ${(req as any).user?.id || req.ip} (plan: ${plan})`);
            res.status(429).json({
                error: 'Too many requests in a short time',
                message: `Please slow down. ${plan.toUpperCase()} plan limit: ${limits.minuteLimit} requests per minute.`,
                plan,
                limit: limits.minuteLimit,
                window: '1 minute'
            });
        }
    });
};

/**
 * Dynamic rate limiter middleware based on user's plan
 */
export const planBasedRateLimiter = (type: 'hourly' | 'minute' = 'hourly') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const plan: PlanTier = user.plan || 'free';

        // Create appropriate limiter
        const limiter = type === 'hourly'
            ? createHourlyLimiter(plan)
            : createMinuteLimiter(plan);

        // Apply limiter
        limiter(req, res, next);
    };
};

/**
 * Concurrent streaming request limiter
 */
export const streamingConcurrencyLimiter = () => {
    const activeStreams = new Map<string, number>();
    const maxConcurrent = parseInt(process.env.CHATBOT_STREAM_CONCURRENT_LIMIT || '3');

    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = user.id.toString();
        const currentCount = activeStreams.get(userId) || 0;

        // Enterprise users have no concurrency limit
        if (user.plan === 'enterprise') {
            return next();
        }

        if (currentCount >= maxConcurrent) {
            logger.warn(`Concurrent streaming limit exceeded for user: ${userId}`);
            return res.status(429).json({
                error: 'Too many concurrent streaming requests',
                message: `Maximum ${maxConcurrent} concurrent streams allowed. Please wait for existing streams to complete.`,
                currentStreams: currentCount,
                maxStreams: maxConcurrent
            });
        }

        // Increment counter
        activeStreams.set(userId, currentCount + 1);

        // Cleanup on response end
        const cleanup = () => {
            const count = activeStreams.get(userId) || 0;
            if (count <= 1) {
                activeStreams.delete(userId);
            } else {
                activeStreams.set(userId, count - 1);
            }
        };

        res.on('finish', cleanup);
        res.on('close', cleanup);
        res.on('error', cleanup);

        next();
    };
};

/**
 * Get rate limit status for user
 */
export const getRateLimitStatus = (req: Request): {
    plan: PlanTier;
    hourlyLimit: number;
    minuteLimit: number;
    unlimited: boolean;
} => {
    const user = (req as any).user;
    const plan: PlanTier = user?.plan || 'free';
    const limits = PLAN_LIMITS[plan];

    return {
        plan,
        hourlyLimit: limits.hourlyLimit,
        minuteLimit: limits.minuteLimit,
        unlimited: limits.hourlyLimit === 0 && limits.minuteLimit === 0
    };
};

/**
 * Combined chatbot rate limiter (both hourly and minute)
 */
export const chatbotRateLimiter = [
    planBasedRateLimiter('minute'),  // Check minute limit first (prevents burst)
    planBasedRateLimiter('hourly')   // Then check hourly limit
];

/**
 * Streaming endpoint rate limiter (includes concurrency check)
 */
export const streamingRateLimiter = [
    streamingConcurrencyLimiter(),   // Check concurrent streams
    planBasedRateLimiter('minute'),  // Check minute limit
    planBasedRateLimiter('hourly')   // Check hourly limit
];
