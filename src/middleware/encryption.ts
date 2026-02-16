import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(text: string, key: Buffer): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        encrypted: encrypted + authTag,
        iv: iv.toString('hex')
    };
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedWithTag: string, ivHex: string, key: Buffer): string {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(encryptedWithTag.slice(-AUTH_TAG_LENGTH * 2), 'hex');
    const encrypted = Buffer.from(encryptedWithTag.slice(0, -AUTH_TAG_LENGTH * 2), 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted as any, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Middleware for global Request/Response Encryption
 */
export const encryptionMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Skip encryption for preflight requests and Polar Webhooks
    if (req.method === 'OPTIONS' || req.originalUrl.includes('/payments/webhook')) {
        return next();
    }

    const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');

    // 1. Decrypt incoming Request Body if encrypted
    if (req.body && req.body.encryptedData && req.body.iv) {
        try {
            const decrypted = decrypt(req.body.encryptedData, req.body.iv, key);
            req.body = JSON.parse(decrypted);
            logger.debug('Decrypted incoming request body');
        } catch (error) {
            logger.error('Failed to decrypt request body:', error);
            return res.status(400).json({ error: 'Encryption error: Could not decrypt payload' });
        }
    }

    // 2. Intercept Response.send to encrypt outgoing data
    const originalSend = res.send;
    res.send = function (body: any): Response {
        // Only encrypt if it's a JSON response and encryption is enabled
        // and if it's not already encrypted
        if (typeof body === 'object' || (typeof body === 'string' && body.startsWith('{'))) {
            try {
                const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
                const { encrypted, iv } = encrypt(bodyString, key);

                // Set custom header to indicate encrypted response
                res.setHeader('X-Response-Encrypted', 'true');

                return originalSend.call(this, JSON.stringify({
                    encryptedData: encrypted,
                    iv: iv,
                    timestamp: new Date().toISOString()
                }));
            } catch (error) {
                logger.error('Failed to encrypt response body:', error);
                return originalSend.call(this, body);
            }
        }
        return originalSend.call(this, body);
    };

    return next();
};
