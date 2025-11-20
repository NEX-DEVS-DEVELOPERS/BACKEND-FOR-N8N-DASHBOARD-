import { env } from '../config/env';

/**
 * Validate webhook URL against whitelist
 * @param url Webhook URL to validate
 * @returns True if URL is allowed
 */
export function validateWebhookUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);

        // Check if URL uses HTTPS (required for security)
        if (parsedUrl.protocol !== 'https:') {
            return false;
        }

        // Check against whitelist
        return env.N8N_WEBHOOK_DOMAIN_WHITELIST.some((domain) =>
            url.startsWith(domain)
        );
    } catch (error) {
        return false;
    }
}

/**
 * Validate email format
 * @param email Email address
 * @returns True if email is valid
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitize user input to prevent XSS
 * @param input User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/[<>]/g, '') // Remove angle brackets
        .trim();
}

/**
 * Validate UUID format
 * @param uuid UUID string
 * @returns True if valid UUID
 */
export function isValidUUID(uuid: string): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate ISO 8601 datetime string
 * @param datetime ISO datetime string
 * @returns True if valid
 */
export function isValidISODateTime(datetime: string): boolean {
    const date = new Date(datetime);
    return !isNaN(date.getTime()) && date.toISOString() === datetime;
}
