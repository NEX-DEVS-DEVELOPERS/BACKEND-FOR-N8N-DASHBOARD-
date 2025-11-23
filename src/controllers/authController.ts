import { Request, Response } from 'express';
import { query, querySingle } from '../config/database';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyToken, getTokenExpiration, hashToken } from '../utils/encryption';
import { User, LoginDTO, LoginResponse, UserResponse } from '../types/auth.types';
import { ApiErrorResponse, ApiSuccessResponse } from '../types/api.types';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Authentication Controller
 */
export class AuthController {
    /**
     * Login handler
     */
    async login(
        req: Request<{}, {}, LoginDTO>,
        res: Response<LoginResponse | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { username, password } = req.body;

            // Find user
            const user = await querySingle<User>(
                `SELECT id, username, password_hash as "passwordHash", email, 
                plan_tier as "planTier", has_247_addon as "has247Addon",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM users WHERE username = $1`,
                [username]
            );

            if (!user) {
                logger.warn('Login attempt with invalid username:', { username, ip: req.ip });
                res.status(401).json({
                    success: false,
                    error: 'Invalid username or password',
                    statusCode: 401,
                });
                return;
            }

            // Verify password
            const isValid = await verifyPassword(password, user.passwordHash);
            if (!isValid) {
                logger.warn('Login attempt with invalid password:', { username, ip: req.ip });
                res.status(401).json({
                    success: false,
                    error: 'Invalid username or password',
                    statusCode: 401,
                });
                return;
            }

            // Generate JWT tokens
            const accessToken = generateAccessToken({
                userId: user.id,
                username: user.username,
                planTier: user.planTier,
            });

            const refreshToken = generateRefreshToken({
                userId: user.id,
                username: user.username,
                planTier: user.planTier,
            });

            const accessExpiresAt = getTokenExpiration(env.JWT_EXPIRES_IN);
            const refreshExpiresAt = getTokenExpiration(env.JWT_REFRESH_EXPIRES_IN);

            // Remove password hash from response
            const { passwordHash, ...userResponse } = user;

            logger.info('User logged in successfully:', { userId: user.id, username });

            res.status(200).json({
                success: true,
                token: accessToken,
                refreshToken,
                expiresAt: accessExpiresAt.toISOString(),
                refreshExpiresAt: refreshExpiresAt.toISOString(),
                user: userResponse,
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({
                success: false,
                error: 'Login failed',
                statusCode: 500,
            });
        }
    }

    /**
     * Validate session/token
     */
    async validate(
        req: Request,
        res: Response<ApiSuccessResponse<{ valid: true; user: UserResponse }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            // User is already attached by auth middleware
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            // Fetch fresh user data
            const user = await querySingle<User>(
                `SELECT id, username, email, plan_tier as "planTier", 
                has_247_addon as "has247Addon", created_at as "createdAt", 
                updated_at as "updatedAt"
         FROM users WHERE id = $1`,
                [req.user.userId]
            );

            if (!user) {
                res.status(401).json({
                    success: false,
                    error: 'User not found',
                    statusCode: 401,
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: {
                    valid: true,
                    user: user as UserResponse,
                },
            });
        } catch (error) {
            logger.error('Validate error:', error);
            res.status(500).json({
                success: false,
                error: 'Validation failed',
                statusCode: 500,
            });
        }
    }

    /**
     * Logout handler with token blacklisting
     */
    async logout(
        req: Request,
        res: Response<ApiSuccessResponse>
    ): Promise<void> {
        try {
            if (req.user) {
                // Get token from Authorization header
                const authHeader = req.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    const token = authHeader.substring(7);
                    const tokenHash = hashToken(token);

                    // Get token expiration
                    const decoded = verifyToken(token);
                    const expiresAt = new Date(decoded.exp! * 1000);

                    // Add token to blacklist
                    await query(
                        `INSERT INTO token_blacklist (token_hash, user_id, expires_at, reason)
                         VALUES ($1, $2, $3, $4)`,
                        [tokenHash, req.user.userId, expiresAt, 'logout']
                    );

                    logger.info('User logged out and token blacklisted:', { userId: req.user.userId });
                } else {
                    logger.info('User logged out:', { userId: req.user.userId });
                }
            }

            res.status(200).json({
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error) {
            logger.error('Logout error:', error);
            // Still return success even if blacklisting fails
            res.status(200).json({
                success: true,
                message: 'Logged out successfully',
            });
        }
    }

    /**
     * Update user plan
     */
    async updatePlan(
        req: Request<{}, {}, { planTier: string; has247Addon: boolean }>,
        res: Response<ApiSuccessResponse<UserResponse> | ApiErrorResponse>
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

            const { planTier, has247Addon } = req.body;

            // Validate plan tier
            const validPlans = ['free', 'pro', 'enterprise'];
            if (!validPlans.includes(planTier)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid plan tier',
                    statusCode: 400,
                });
                return;
            }

            // Update user plan
            const updatedUser = await querySingle<User>(
                `UPDATE users 
                 SET plan_tier = $1, has_247_addon = $2, updated_at = NOW()
                 WHERE id = $3
                 RETURNING id, username, email, plan_tier as "planTier", 
                           has_247_addon as "has247Addon", created_at as "createdAt", 
                           updated_at as "updatedAt"`,
                [planTier, has247Addon, req.user.userId]
            );

            if (!updatedUser) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                    statusCode: 404,
                });
                return;
            }

            logger.info('User plan updated:', {
                userId: req.user.userId,
                planTier,
                has247Addon
            });

            res.status(200).json({
                success: true,
                data: updatedUser as UserResponse,
                message: 'Plan updated successfully',
            });
        } catch (error) {
            logger.error('Update plan error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update plan',
                statusCode: 500,
            });
        }
    }

    /**
     * Cancel user plan (downgrade to free)
     */
    async cancelPlan(
        req: Request,
        res: Response<ApiSuccessResponse<UserResponse> | ApiErrorResponse>
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

            // Downgrade to free plan and remove addons
            const updatedUser = await querySingle<User>(
                `UPDATE users 
                 SET plan_tier = 'free', has_247_addon = false, updated_at = NOW()
                 WHERE id = $1
                 RETURNING id, username, email, plan_tier as "planTier", 
                           has_247_addon as "has247Addon", created_at as "createdAt", 
                           updated_at as "updatedAt"`,
                [req.user.userId]
            );

            if (!updatedUser) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                    statusCode: 404,
                });
                return;
            }

            logger.info('User plan cancelled (downgraded to free):', {
                userId: req.user.userId
            });

            res.status(200).json({
                success: true,
                data: updatedUser as UserResponse,
                message: 'Plan cancelled successfully. You have been downgraded to the free tier.',
            });
        } catch (error) {
            logger.error('Cancel plan error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel plan',
                statusCode: 500,
            });
        }
    }

    /**
     * Sync users from environment variables
     * Creates or updates users based on the USERS array in .env
     */
    async syncUsersFromEnv(): Promise<void> {
        try {
            const users = env.USERS;

            if (!users || users.length === 0) {
                logger.warn('No users defined in USERS environment variable');
                return;
            }

            for (const userData of users) {
                const { username, password, email, plan } = userData;

                // Validate required fields
                if (!username || !password) {
                    logger.error('Invalid user data in USERS array - missing username or password:', userData);
                    continue;
                }

                // Check if user exists
                const existingUser = await querySingle<User>(
                    `SELECT id FROM users WHERE username = $1`,
                    [username]
                );

                const passwordHash = await hashPassword(password);
                const userPlan = plan || 'free'; // Default to 'free' if not specified

                if (existingUser) {
                    // Update existing user
                    await query(
                        `UPDATE users 
                         SET password_hash = $1, email = $2, plan_tier = $3, updated_at = NOW()
                         WHERE username = $4`,
                        [passwordHash, email, userPlan, username]
                    );
                    logger.info('✅ User updated from environment variables:', { username, plan: userPlan });
                } else {
                    // Create new user
                    await query(
                        `INSERT INTO users (username, password_hash, email, plan_tier)
                         VALUES ($1, $2, $3, $4)`,
                        [username, passwordHash, email, userPlan]
                    );
                    logger.info('✅ User created from environment variables:', { username, plan: userPlan });
                }
            }

            logger.info(`✅ Synced ${users.length} user(s) from environment variables`);
        } catch (error) {
            logger.error('Failed to sync users from environment:', error);
        }
    }

    /**
     * Verify admin panel password
     */
    async verifyAdminPassword(password: string): Promise<boolean> {
        return password === env.ADMIN_PANEL_PASSWORD;
    }

    /**
     * Create a new user (for admin panel)
     */
    async createUser(
        req: Request<{}, {}, { username: string; password: string; email?: string; plan?: string; adminPassword: string }>,
        res: Response<ApiSuccessResponse<UserResponse> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { username, password, email, plan, adminPassword } = req.body;

            // Verify admin password
            if (!this.verifyAdminPassword(adminPassword)) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid admin password',
                    statusCode: 401,
                });
                return;
            }

            // Validate input
            if (!username || !password) {
                res.status(400).json({
                    success: false,
                    error: 'Username and password are required',
                    statusCode: 400,
                });
                return;
            }

            if (password.length < 8) {
                res.status(400).json({
                    success: false,
                    error: 'Password must be at least 8 characters',
                    statusCode: 400,
                });
                return;
            }

            // Check if user already exists
            const existingUser = await querySingle<User>(
                `SELECT id FROM users WHERE username = $1`,
                [username]
            );

            if (existingUser) {
                res.status(409).json({
                    success: false,
                    error: 'Username already exists',
                    statusCode: 409,
                });
                return;
            }

            // Hash password and create user
            const passwordHash = await hashPassword(password);
            const userPlan = plan || 'free'; // Default to 'free'

            const newUser = await querySingle<User>(
                `INSERT INTO users (username, password_hash, email, plan_tier)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, username, email, plan_tier as "planTier", 
                           has_247_addon as "has247Addon", created_at as "createdAt", 
                           updated_at as "updatedAt"`,
                [username, passwordHash, email, userPlan]
            );

            if (!newUser) {
                throw new Error('Failed to create user');
            }

            logger.info('User created via admin panel:', { username, plan: userPlan });

            res.status(201).json({
                success: true,
                data: newUser as UserResponse,
                message: 'User created successfully',
            });
        } catch (error) {
            logger.error('Create user error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create user',
                statusCode: 500,
            });
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(
        req: Request<{}, {}, { refreshToken: string }>,
        res: Response<ApiSuccessResponse<{ token: string; expiresAt: string }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    error: 'Refresh token is required',
                    statusCode: 400,
                });
                return;
            }

            // Verify refresh token
            let decoded;
            try {
                decoded = verifyToken(refreshToken);
            } catch (error) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid or expired refresh token',
                    statusCode: 401,
                });
                return;
            }

            // Check if token is blacklisted
            const tokenHash = hashToken(refreshToken);
            const blacklisted = await querySingle(
                `SELECT id FROM token_blacklist WHERE token_hash = $1`,
                [tokenHash]
            );

            if (blacklisted) {
                res.status(401).json({
                    success: false,
                    error: 'Token has been invalidated',
                    statusCode: 401,
                });
                return;
            }

            // Fetch fresh user data
            const user = await querySingle<User>(
                `SELECT id, username, plan_tier as "planTier"
                 FROM users WHERE id = $1`,
                [decoded.userId]
            );

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                    statusCode: 404,
                });
                return;
            }

            // Generate new access token with fresh user data
            const newAccessToken = generateAccessToken({
                userId: user.id,
                username: user.username,
                planTier: user.planTier,
            });

            const expiresAt = getTokenExpiration(env.JWT_EXPIRES_IN);

            logger.info('Access token refreshed:', { userId: user.id });

            res.status(200).json({
                success: true,
                data: {
                    token: newAccessToken,
                    expiresAt: expiresAt.toISOString(),
                },
            });
        } catch (error) {
            logger.error('Refresh token error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to refresh token',
                statusCode: 500,
            });
        }
    }

}

export const authController = new AuthController();
