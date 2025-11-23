import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Audit event types for tracking security-sensitive operations
 */
export enum AuditEventType {
    LOGIN_SUCCESS = 'LOGIN_SUCCESS',
    LOGIN_FAILED = 'LOGIN_FAILED',
    LOGOUT = 'LOGOUT',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    PLAN_UPGRADE = 'PLAN_UPGRADE',
    PLAN_DOWNGRADE = 'PLAN_DOWNGRADE',
    PLAN_CANCEL = 'PLAN_CANCEL',
    USER_CREATED = 'USER_CREATED',
    PREFERENCES_UPDATED = 'PREFERENCES_UPDATED',
    UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
    eventType: AuditEventType;
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
    details?: Record<string, any>;
    success: boolean;
}

/**
 * Create an audit log entry
 */
export function logAuditEvent(
    eventType: AuditEventType,
    req: Request,
    success: boolean,
    details?: Record<string, any>
): void {
    const auditEntry: AuditLogEntry = {
        eventType,
        userId: req.user?.userId,
        username: req.user?.username || (req.body?.username as string),
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date(),
        details,
        success,
    };

    // Log to application logger
    const logLevel = success ? 'info' : 'warn';
    logger[logLevel]('Audit Event:', auditEntry);

    // In production, you could also:
    // 1. Store to audit_logs table in database
    // 2. Send to external security monitoring service (e.g., Datadog, Sentry)
    // 3. Trigger alerts for critical events
}

/**
 * Middleware to audit login attempts
 */
export function auditLoginAttempt(success: boolean) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const eventType = success ? AuditEventType.LOGIN_SUCCESS : AuditEventType.LOGIN_FAILED;
        logAuditEvent(eventType, req, success, {
            username: req.body?.username,
        });
        next();
    };
}

/**
 * Middleware to audit plan changes
 */
export function auditPlanChange(changeType: 'upgrade' | 'downgrade' | 'cancel') {
    return (req: Request, res: Response, next: NextFunction): void => {
        let eventType: AuditEventType;
        switch (changeType) {
            case 'upgrade':
                eventType = AuditEventType.PLAN_UPGRADE;
                break;
            case 'downgrade':
                eventType = AuditEventType.PLAN_DOWNGRADE;
                break;
            case 'cancel':
                eventType = AuditEventType.PLAN_CANCEL;
                break;
        }

        logAuditEvent(eventType, req, true, {
            oldPlan: req.user?.planTier,
            newPlan: req.body?.planTier || 'free',
        });
        next();
    };
}

/**
 * Middleware to audit unauthorized access attempts
 */
export function auditUnauthorizedAccess(req: Request, _res: Response, next: NextFunction): void {
    logAuditEvent(AuditEventType.UNAUTHORIZED_ACCESS, req, false, {
        path: req.path,
        method: req.method,
    });
    next();
}

/**
 * Middleware to audit rate limit violations
 */
export function auditRateLimitExceeded(req: Request, _res: Response, next: NextFunction): void {
    logAuditEvent(AuditEventType.RATE_LIMIT_EXCEEDED, req, false, {
        path: req.path,
        method: req.method,
        limit: req.rateLimit?.limit,
    });
    next();
}

/**
 * Middleware to audit user creation
 */
export function auditUserCreation(req: Request, _res: Response, next: NextFunction): void {
    logAuditEvent(AuditEventType.USER_CREATED, req, true, {
        newUsername: req.body?.username,
        plan: req.body?.plan || 'free',
    });
    next();
}

/**
 * Middleware to audit password changes
 */
export function auditPasswordChange(req: Request, _res: Response, next: NextFunction): void {
    logAuditEvent(AuditEventType.PASSWORD_CHANGE, req, true, {
        userId: req.user?.userId,
    });
    next();
}
