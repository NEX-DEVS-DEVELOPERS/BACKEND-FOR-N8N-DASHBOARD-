import winston from 'winston';
import { env } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

// Ensure log directory exists
if (!fs.existsSync(env.LOG_FILE_PATH)) {
    fs.mkdirSync(env.LOG_FILE_PATH, { recursive: true });
}

// PII scrubbing regex patterns
const PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    password: /(password["']?\s*[:=]\s*["'])(?:(?!"|').)*?(")/gi,
    token: /(token["']?\s*[:=]\s*["'])(?:(?!"|').)*?(")/gi,
    apiKey: /(key["']?\s*[:=]\s*["'])(?:(?!"|').)*?(")/gi,
    creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
};

// PII scrubbing format
const piiScrubbing = winston.format((info) => {
    const scrub = (val: any): any => {
        if (typeof val === 'string') {
            let scrubbed = val;
            scrubbed = scrubbed.replace(PII_PATTERNS.email, '[EMAIL_REDACTED]');
            scrubbed = scrubbed.replace(PII_PATTERNS.password, '$1[PASSWORD_REDACTED]$2');
            scrubbed = scrubbed.replace(PII_PATTERNS.token, '$1[TOKEN_REDACTED]$2');
            scrubbed = scrubbed.replace(PII_PATTERNS.apiKey, '$1[KEY_REDACTED]$2');
            scrubbed = scrubbed.replace(PII_PATTERNS.creditCard, '[CARD_REDACTED]');
            return scrubbed;
        }
        if (typeof val === 'object' && val !== null) {
            const newObj: any = Array.isArray(val) ? [] : {};
            for (const key in val) {
                // Skip scrubbing keys that are typically safe
                if (['timestamp', 'level', 'message', 'id', 'agent_id', 'session_id'].includes(key)) {
                    newObj[key] = val[key];
                } else {
                    newObj[key] = scrub(val[key]);
                }
            }
            return newObj;
        }
        return val;
    };

    info.message = scrub(info.message);
    // Scrub metadata
    const { timestamp, level, message, ...meta } = info;
    const scrubbedMeta = scrub(meta);
    Object.assign(info, scrubbedMeta);

    return info;
});

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    piiScrubbing(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const emoji = {
            info: '🔹',
            error: '❌',
            warn: '⚠️',
            debug: '⚙️'
        }[level.replace(/\u001b\[[0-9;]*m/g, '')] || '📝'; // Remove ANSI colors for mapping

        const metaStr = Object.keys(meta).length > 0
            ? `\n   ${JSON.stringify(meta, null, 2).split('\n').join('\n   ')}`
            : '';

        return `${timestamp} ${emoji} [${level}]: ${message}${metaStr}`;
    })
);

// Create logger instance
export const logger = winston.createLogger({
    level: env.LOG_LEVEL,
    format: logFormat,
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(env.LOG_FILE_PATH, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(env.LOG_FILE_PATH, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// Add console transport in development
if (env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: consoleFormat,
        })
    );
}

// Log unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

export default logger;
