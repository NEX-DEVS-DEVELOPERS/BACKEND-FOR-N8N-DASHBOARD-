import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables with explicit path (resolves CWD issues)
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error(`[ENV ERROR] Failed to load .env from: ${envPath}`);
    console.error(result.error);
}

// Debug: Uncomment to verify loading
// console.log('[ENV DEBUG] GEMINI_API_KEY loaded:', !!process.env.GEMINI_API_KEY);

// Environment variable schema
const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3001'),
    HOST: z.string().default('0.0.0.0'),

    // Database - Neon DB
    DATABASE_URL: z.string().url(),



    // Authentication
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('12h'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    BCRYPT_ROUNDS: z.string().transform(Number).default('12'),

    // Users - JSON array of user objects
    USERS: z.string().transform((val) => {
        try {
            const parsed = JSON.parse(val);
            if (!Array.isArray(parsed)) {
                throw new Error('USERS must be a JSON array');
            }
            return parsed.map((user: any) => ({
                username: String(user.username),
                password: String(user.password),
                email: user.email ? String(user.email) : undefined,
                plan: user.plan || 'free',
            }));
        } catch (error) {
            throw new Error(`Invalid USERS format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }),

    // Admin Panel Password
    ADMIN_PANEL_PASSWORD: z.string().min(8),

    // n8n Configuration
    N8N_BASE_URL: z.string().url(),
    N8N_API_KEY: z.string().optional(),
    N8N_WEBHOOK_DOMAIN_WHITELIST: z.string().transform(val => val.split(',')),

    // AI / Chatbot Configuration
    GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required for the chatbot"),

    // Email (Optional)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().transform(Number).optional(),
    SMTP_SECURE: z.string().transform(val => val === 'true').optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    SUPPORT_EMAIL_ALI: z.string().email().optional(),
    SUPPORT_EMAIL_HASSAM_FAIZAN: z.string().email().optional(),
    SUPPORT_EMAIL_MUDASSIR_USMAN: z.string().email().optional(),

    // CORS & Security
    CORS_ORIGIN: z.string().transform(val => val.split(',')),
    ALLOWED_IPS: z.string().default('*'),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
    AUTH_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('20'),

    FORM_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('3600000'),
    FORM_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('10'),

    // Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    LOG_FILE_PATH: z.string().default('./logs'),

    // Frontend
    FRONTEND_URL: z.string().url(),

    // Webhook Secret
    WEBHOOK_SECRET: z.string().optional(),
});

// Validate and export environment variables
export const env = envSchema.parse(process.env);

// Type export
export type Env = z.infer<typeof envSchema>;
