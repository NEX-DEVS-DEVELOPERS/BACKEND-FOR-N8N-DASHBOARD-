import { Request, Response } from 'express';
import { query, querySingle } from '../config/database';
import { verifyPassword, hashPassword } from '../utils/encryption';
import { ApiErrorResponse, ApiSuccessResponse } from '../types/api.types';
import { logger } from '../utils/logger';

// Track backend start time
const serverStartTime = Date.now();

interface UserPreferences {
    id: string;
    userId: string;
    emailNotifications: boolean;
    agentStatusNotifications: boolean;
    weeklyReports: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface UptimeResponse {
    uptime: number;
    uptimeFormatted: string;
    startTime: string;
}

interface PreferencesDTO {
    emailNotifications?: boolean;
    agentStatusNotifications?: boolean;
    weeklyReports?: boolean;
}

interface ChangePasswordDTO {
    currentPassword: string;
    newPassword: string;
}

/**
 * Settings Controller
 */
export class SettingsController {
    /**
     * Get server uptime
     */
    async getUptime(
        _req: Request,
        res: Response<ApiSuccessResponse<UptimeResponse> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
            const uptimeFormatted = this.formatUptime(uptimeSeconds);

            res.status(200).json({
                success: true,
                data: {
                    uptime: uptimeSeconds,
                    uptimeFormatted,
                    startTime: new Date(serverStartTime).toISOString(),
                },
            });
        } catch (error) {
            logger.error('Get uptime error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get uptime',
                statusCode: 500,
            });
        }
    }

    /**
     * Format uptime in human-readable format
     */
    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${secs}s`);

        return parts.join(' ');
    }

    /**
     * Get user preferences
     */
    async getPreferences(
        req: Request,
        res: Response<ApiSuccessResponse<UserPreferences> | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            // Get or create user preferences
            let preferences = await querySingle<UserPreferences>(
                `SELECT id, user_id as "userId", 
                        email_notifications as "emailNotifications",
                        agent_status_notifications as "agentStatusNotifications",
                        weekly_reports as "weeklyReports",
                        created_at as "createdAt", updated_at as "updatedAt"
                 FROM user_preferences WHERE user_id = $1`,
                [req.user.userId]
            );

            // If no preferences exist, create default ones
            if (!preferences) {
                preferences = await querySingle<UserPreferences>(
                    `INSERT INTO user_preferences (user_id, email_notifications, agent_status_notifications, weekly_reports)
                     VALUES ($1, true, true, false)
                     RETURNING id, user_id as "userId", 
                               email_notifications as "emailNotifications",
                               agent_status_notifications as "agentStatusNotifications",
                               weekly_reports as "weeklyReports",
                               created_at as "createdAt", updated_at as "updatedAt"`,
                    [req.user.userId]
                );
            }

            if (!preferences) {
                throw new Error('Failed to create preferences');
            }

            res.status(200).json({
                success: true,
                data: preferences,
            });
        } catch (error) {
            logger.error('Get preferences error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get preferences',
                statusCode: 500,
            });
        }
    }

    /**
     * Update user preferences
     */
    async updatePreferences(
        req: Request<{}, {}, PreferencesDTO>,
        res: Response<ApiSuccessResponse<UserPreferences> | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const { emailNotifications, agentStatusNotifications, weeklyReports } = req.body;

            // Build dynamic update query
            const updates: string[] = [];
            const values: any[] = [];
            let paramCount = 1;

            if (emailNotifications !== undefined) {
                updates.push(`email_notifications = $${paramCount++}`);
                values.push(emailNotifications);
            }
            if (agentStatusNotifications !== undefined) {
                updates.push(`agent_status_notifications = $${paramCount++}`);
                values.push(agentStatusNotifications);
            }
            if (weeklyReports !== undefined) {
                updates.push(`weekly_reports = $${paramCount++}`);
                values.push(weeklyReports);
            }

            if (updates.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No preferences to update',
                    statusCode: 400,
                });
                return;
            }

            updates.push(`updated_at = NOW()`);
            values.push(req.user.userId);

            const updatedPreferences = await querySingle<UserPreferences>(
                `UPDATE user_preferences 
                 SET ${updates.join(', ')}
                 WHERE user_id = $${paramCount}
                 RETURNING id, user_id as "userId", 
                           email_notifications as "emailNotifications",
                           agent_status_notifications as "agentStatusNotifications",
                           weekly_reports as "weeklyReports",
                           created_at as "createdAt", updated_at as "updatedAt"`,
                values
            );

            if (!updatedPreferences) {
                // If no preferences exist, create them
                const newPreferences = await querySingle<UserPreferences>(
                    `INSERT INTO user_preferences (user_id, email_notifications, agent_status_notifications, weekly_reports)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id, user_id as "userId", 
                               email_notifications as "emailNotifications",
                               agent_status_notifications as "agentStatusNotifications",
                               weekly_reports as "weeklyReports",
                               created_at as "createdAt", updated_at as "updatedAt"`,
                    [
                        req.user.userId,
                        emailNotifications ?? true,
                        agentStatusNotifications ?? true,
                        weeklyReports ?? false
                    ]
                );

                if (!newPreferences) {
                    throw new Error('Failed to create preferences');
                }

                res.status(201).json({
                    success: true,
                    data: newPreferences,
                    message: 'Preferences created successfully',
                });
                return;
            }

            logger.info('User preferences updated:', {
                userId: req.user.userId,
                preferences: updatedPreferences
            });

            res.status(200).json({
                success: true,
                data: updatedPreferences,
                message: 'Preferences updated successfully',
            });
        } catch (error) {
            logger.error('Update preferences error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update preferences',
                statusCode: 500,
            });
        }
    }

    /**
     * Change user password
     */
    async changePassword(
        req: Request<{}, {}, ChangePasswordDTO>,
        res: Response<ApiSuccessResponse | ApiErrorResponse>
    ): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            const { currentPassword, newPassword } = req.body;

            // Validate input
            if (!currentPassword || !newPassword) {
                res.status(400).json({
                    success: false,
                    error: 'Current password and new password are required',
                    statusCode: 400,
                });
                return;
            }

            if (newPassword.length < 8) {
                res.status(400).json({
                    success: false,
                    error: 'New password must be at least 8 characters',
                    statusCode: 400,
                });
                return;
            }

            // Get current user password hash
            const user = await querySingle<{ passwordHash: string }>(
                `SELECT password_hash as "passwordHash" FROM users WHERE id = $1`,
                [req.user.userId]
            );

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                    statusCode: 404,
                });
                return;
            }

            // Verify current password
            const isValid = await verifyPassword(currentPassword, user.passwordHash);
            if (!isValid) {
                logger.warn('Failed password change attempt:', {
                    userId: req.user.userId
                });
                res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect',
                    statusCode: 401,
                });
                return;
            }

            // Hash new password
            const newPasswordHash = await hashPassword(newPassword);

            // Update password
            await query(
                `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
                [newPasswordHash, req.user.userId]
            );

            logger.info('Password changed successfully:', {
                userId: req.user.userId
            });

            res.status(200).json({
                success: true,
                message: 'Password changed successfully',
            });
        } catch (error) {
            logger.error('Change password error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to change password',
                statusCode: 500,
            });
        }
    }
}

export const settingsController = new SettingsController();
