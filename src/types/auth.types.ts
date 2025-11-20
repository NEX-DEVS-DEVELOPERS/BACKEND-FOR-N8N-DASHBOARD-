import { z } from 'zod';

// Plan Tier type
export type PlanTier = 'free' | 'pro' | 'enterprise';

// User interface
export interface User {
    id: string;
    username: string;
    passwordHash: string;
    email: string | null;
    planTier: PlanTier;
    has247Addon: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Login request schema
export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(8),
});

// Token payload
export interface TokenPayload {
    userId: string;
    username: string;
    planTier: PlanTier;
}

// Session data
export interface Session {
    token: string;
    expiresAt: Date;
    user: UserResponse;
}

// User response (without password hash)
export type UserResponse = Omit<User, 'passwordHash'>;

// Login response
export interface LoginResponse {
    success: boolean;
    token: string;
    expiresAt: string;
    user: UserResponse;
}

// DTOs
export type LoginDTO = z.infer<typeof loginSchema>;

// Express Request with User
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}
