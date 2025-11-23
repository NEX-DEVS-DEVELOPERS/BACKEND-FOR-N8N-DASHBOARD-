import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { TokenPayload } from '../types/auth.types';

/**
 * Hash a password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password Plain text password
 * @param hash Hashed password
 * @returns True if password matches
 */
export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT access token
 * @param payload Token payload
 * @returns JWT token
 */
export function generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
}

/**
 * Generate a JWT refresh token
 * @param payload Token payload
 * @returns JWT refresh token
 */
export function generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });
}

/**
 * Verify and decode a JWT token
 * @param token JWT token
 * @returns Decoded token payload
 */
export function verifyToken(token: string): TokenPayload {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
        return decoded;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Calculate token expiration timestamp
 * @param expiresIn Time string (e.g., "15m", "12h", "7d")
 * @returns Expiration date
 */
export function getTokenExpiration(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([mhd])$/);
    if (!match) {
        throw new Error('Invalid expiration format');
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const now = new Date();
    if (unit === 'm') {
        now.setMinutes(now.getMinutes() + value);
    } else if (unit === 'h') {
        now.setHours(now.getHours() + value);
    } else if (unit === 'd') {
        now.setDate(now.getDate() + value);
    }

    return now;
}

/**
 * Generate SHA-256 hash of a token for blacklist storage
 * @param token JWT token
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
