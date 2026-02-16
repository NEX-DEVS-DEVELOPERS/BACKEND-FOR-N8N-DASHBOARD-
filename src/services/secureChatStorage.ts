import { query } from '../config/database';
import { logger } from '../utils/logger';
import {
    encryptChatData,
    decryptChatData,
    compressMessages,
    decompressMessages,
    generateSessionKey,
    calculateStorageSize
} from '../utils/chatEncryption';

export interface ChatSession {
    id: string;
    sessionKey: string;
    title: string;
    messageCount: number;
    hasUserMessages: boolean;
    firstUserMessagePreview: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Session limits based on plan
const SESSION_LIMITS = {
    free: 0,
    pro: 5,
    enterprise: 20
};

// Session expiry hours based on plan
const SESSION_EXPIRY = {
    free: 24,
    pro: 72,
    enterprise: 168
};

// Maximum storage per session (100KB)
const MAX_STORAGE_BYTES = 100 * 1024;

class SecureChatStorageService {
    /**
     * Create a new chat session
     * Note: Session won't be saved permanently until user sends a message
     */
    async createSession(userId: string, userPlan: string): Promise<ChatSession | null> {
        try {
            const sessionKey = generateSessionKey();
            const expiryHours = SESSION_EXPIRY[userPlan as keyof typeof SESSION_EXPIRY] || SESSION_EXPIRY.free;

            const result = await query<any>(
                `INSERT INTO chat_sessions (
                    user_id, session_key, title, message_count, has_user_messages,
                    expires_at
                ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${expiryHours} hours')
                RETURNING id, session_key, title, message_count, has_user_messages,
                          first_user_message_preview, created_at, updated_at`,
                [userId, sessionKey, 'New Conversation', 0, false]
            );

            if (!result || result.length === 0) return null;

            const session = result[0];
            return {
                id: session.id,
                sessionKey: session.session_key,
                title: session.title,
                messageCount: session.message_count,
                hasUserMessages: session.has_user_messages,
                firstUserMessagePreview: session.first_user_message_preview,
                createdAt: session.created_at,
                updatedAt: session.updated_at
            };
        } catch (error) {
            logger.debug('Could not create chat session:', error);
            return null;
        }
    }

    /**
     * Save encrypted chat memory for a session
     * Only saves if user has sent at least one message
     */
    async saveChatMemory(
        sessionId: string,
        userId: string,
        messages: any[],
        modelUsed: string
    ): Promise<void> {
        try {
            const userMessages = messages.filter(m => m.author === 'user');
            const hasUserMessages = userMessages.length > 0;

            // Don't store sessions without user messages
            if (!hasUserMessages) {
                // Delete the empty session
                await this.deleteEmptySession(sessionId, userId);
                return;
            }

            const firstUserMessage = userMessages[0]?.text?.substring(0, 100) || null;
            const newTitle = firstUserMessage ? firstUserMessage.substring(0, 50) : null;

            // Compress and encrypt messages
            const compressed = compressMessages(messages);
            const { encrypted, iv } = encryptChatData(compressed, userId);
            const storageSize = calculateStorageSize(encrypted);

            // Check storage limit
            if (storageSize > MAX_STORAGE_BYTES) {
                logger.warn(`Chat memory exceeds limit for session ${sessionId}`);
                // Only store the last 20 messages if over limit
                const truncatedMessages = messages.slice(-20);
                const truncatedCompressed = compressMessages(truncatedMessages);
                const { encrypted: truncatedEncrypted, iv: truncatedIv } = encryptChatData(truncatedCompressed, userId);

                await this.saveEncryptedMemory(sessionId, userId, truncatedEncrypted, truncatedIv, truncatedMessages.length);
            } else {
                await this.saveEncryptedMemory(sessionId, userId, encrypted, iv, messages.length);
            }

            // Update session metadata
            await query(
                `UPDATE chat_sessions SET
                    message_count = $1,
                    has_user_messages = $2,
                    first_user_message_preview = $3::TEXT,
                    model_used = $4,
                    title = CASE 
                        WHEN title = 'New Conversation' AND $5::TEXT IS NOT NULL 
                        THEN $5::TEXT
                        ELSE title 
                    END,
                    updated_at = NOW()
                WHERE id = $6`,
                [messages.length, hasUserMessages, firstUserMessage, modelUsed, newTitle, sessionId]
            );

            logger.debug(`Saved encrypted chat memory for session ${sessionId}`);

        } catch (error) {
            logger.error('Failed to save chat memory:', error);
        }
    }

    /**
     * Save encrypted memory to database
     */
    private async saveEncryptedMemory(
        sessionId: string,
        userId: string,
        encrypted: Buffer,
        iv: Buffer,
        messageCount: number
    ): Promise<void> {
        const storageSize = calculateStorageSize(encrypted);

        // Upsert: Update if exists, insert if not
        await query(
            `INSERT INTO chat_memory (
                session_id, user_id, encrypted_messages, encryption_iv,
                message_count, storage_size_bytes, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (session_id) 
            DO UPDATE SET 
                encrypted_messages = EXCLUDED.encrypted_messages,
                encryption_iv = EXCLUDED.encryption_iv,
                message_count = EXCLUDED.message_count,
                storage_size_bytes = EXCLUDED.storage_size_bytes,
                updated_at = NOW()`,
            [sessionId, userId, encrypted, iv, messageCount, storageSize]
        );
    }

    /**
     * Delete empty sessions (no user messages)
     */
    private async deleteEmptySession(sessionId: string, userId: string): Promise<void> {
        try {
            await query(
                `DELETE FROM chat_sessions 
                 WHERE id = $1 AND user_id = $2 AND has_user_messages = false`,
                [sessionId, userId]
            );
        } catch (error) {
            // Silent fail - this is cleanup
        }
    }

    /**
     * Load and decrypt chat memory for a session
     */
    async loadChatMemory(sessionId: string, userId: string): Promise<any[]> {
        try {
            const result = await query<any>(
                `SELECT encrypted_messages, encryption_iv 
                 FROM chat_memory 
                 WHERE session_id = $1 AND user_id = $2`,
                [sessionId, userId]
            );

            if (!result || result.length === 0) {
                return [];
            }

            const { encrypted_messages, encryption_iv } = result[0];

            // Decrypt and decompress
            const decrypted = decryptChatData(encrypted_messages, encryption_iv, userId);
            const messages = decompressMessages(decrypted);

            return messages;
        } catch (error) {
            logger.error('Failed to load chat memory:', error);
            return [];
        }
    }

    /**
     * Get user's chat sessions (only those with actual user messages)
     */
    async getUserSessions(userId: string, userPlan: string): Promise<ChatSession[]> {
        try {
            const limit = SESSION_LIMITS[userPlan as keyof typeof SESSION_LIMITS] || 0;

            if (limit === 0) {
                return [];
            }

            const result = await query<any>(
                `SELECT id, session_key, title, message_count, has_user_messages,
                        first_user_message_preview, created_at, updated_at
                 FROM chat_sessions
                 WHERE user_id = $1 
                   AND has_user_messages = true
                   AND expires_at > NOW()
                 ORDER BY updated_at DESC
                 LIMIT $2`,
                [userId, limit]
            );

            return result.map(session => ({
                id: session.id,
                sessionKey: session.session_key,
                title: session.title || session.first_user_message_preview?.substring(0, 30) || 'Chat',
                messageCount: session.message_count,
                hasUserMessages: session.has_user_messages,
                firstUserMessagePreview: session.first_user_message_preview,
                createdAt: session.created_at,
                updatedAt: session.updated_at
            }));
        } catch (error) {
            logger.debug('Could not get user sessions:', error);
            return [];
        }
    }

    /**
     * Delete a session and its encrypted memory
     */
    async deleteSession(sessionId: string, userId: string): Promise<boolean> {
        try {
            // Delete session (cascade will delete memory)
            await query(
                `DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`,
                [sessionId, userId]
            );
            return true;
        } catch (error) {
            logger.error('Failed to delete session:', error);
            return false;
        }
    }

    /**
     * Cleanup expired sessions (run periodically)
     */
    async cleanupExpiredSessions(): Promise<number> {
        try {
            const result = await query<any>(
                `DELETE FROM chat_sessions WHERE expires_at < NOW() RETURNING id`
            );
            const count = result?.length || 0;
            if (count > 0) {
                logger.info(`Cleaned up ${count} expired chat sessions`);
            }
            return count;
        } catch (error) {
            logger.error('Failed to cleanup expired sessions:', error);
            return 0;
        }
    }

    /**
     * Cleanup empty sessions (no user messages after 24 hours)
     */
    async cleanupEmptySessions(): Promise<number> {
        try {
            const result = await query<any>(
                `DELETE FROM chat_sessions 
                 WHERE has_user_messages = false 
                 AND created_at < NOW() - INTERVAL '24 hours'
                 RETURNING id`
            );
            const count = result?.length || 0;
            if (count > 0) {
                logger.info(`Cleaned up ${count} empty chat sessions`);
            }
            return count;
        } catch (error) {
            logger.error('Failed to cleanup empty sessions:', error);
            return 0;
        }
    }
}

export const secureChatStorage = new SecureChatStorageService();
