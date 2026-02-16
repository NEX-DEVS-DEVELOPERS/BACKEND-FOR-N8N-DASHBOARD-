import crypto from 'crypto';
import zlib from 'zlib';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;


/**
 * Derive a unique encryption key for each user
 * Uses PBKDF2 with the master secret and user ID
 */
function deriveUserKey(userId: string, masterSecret: string): Buffer {
    const salt = crypto.createHash('sha256').update(`${userId}:${masterSecret}`).digest();
    return crypto.pbkdf2Sync(masterSecret, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Compress messages before encryption to reduce storage size
 */
export function compressMessages(messages: any[]): Buffer {
    const json = JSON.stringify(messages);
    return zlib.deflateSync(json);
}

/**
 * Decompress messages after decryption
 */
export function decompressMessages(compressed: Buffer): any[] {
    const json = zlib.inflateSync(compressed).toString('utf8');
    return JSON.parse(json);
}

/**
 * Encrypt chat data using AES-256-GCM with user-specific key
 */
export function encryptChatData(
    data: Buffer,
    userId: string,
    masterSecret: string = env.ENCRYPTION_KEY
): { encrypted: Buffer; iv: Buffer } {
    const key = deriveUserKey(userId, masterSecret);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final(),
        cipher.getAuthTag()
    ]);

    return { encrypted, iv };
}

/**
 * Decrypt chat data using AES-256-GCM with user-specific key
 */
export function decryptChatData(
    encrypted: Buffer,
    iv: Buffer,
    userId: string,
    masterSecret: string = env.ENCRYPTION_KEY
): Buffer {
    const key = deriveUserKey(userId, masterSecret);

    // Extract auth tag from the end of encrypted data
    const authTag = encrypted.slice(-AUTH_TAG_LENGTH);
    const encryptedData = encrypted.slice(0, -AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
    ]);
}

/**
 * Generate a secure random session key
 */
export function generateSessionKey(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a message for deduplication (one-way hash, can't be reversed)
 */
export function hashMessage(message: string): string {
    return crypto.createHash('sha256').update(message).digest('hex').substring(0, 16);
}

/**
 * Calculate storage size in bytes
 */
export function calculateStorageSize(data: Buffer): number {
    return data.length;
}
