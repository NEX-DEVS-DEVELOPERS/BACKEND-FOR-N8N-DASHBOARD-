import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import { helmetMiddleware, corsMiddleware, xssProtection, requestSizeValidator } from './middleware/security';
import { errorHandler, notFoundHandler, correlationIdMiddleware } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { validateApiKey } from './middleware/apiKey';
import { encryptionMiddleware } from './middleware/encryption';

// Import routes
import authRoutes from './routes/auth.routes';
import agentRoutes from './routes/agents.routes';
import logRoutes from './routes/logs.routes';
import sseRoutes from './routes/sse.routes';
import formRoutes from './routes/forms.routes';
import statsRoutes from './routes/stats.routes';
import adminRoutes from './routes/admin.routes';
import settingsRoutes from './routes/settings.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { chatbotRoutes } from './routes/chatbot.routes';
import n8nLogsRoutes from './routes/n8n-logs.routes';
import n8nProxyRoutes from './routes/n8n-proxy.routes';
import paymentRoutes from './routes/payments.routes';
import supportRoutes from './routes/support.routes';
import notificationRoutes from './routes/notification.routes';

// Import services for health check
import { testConnection } from './config/database';
import { n8nService } from './services/n8nService';
import { HealthCheckResponse } from './types/api.types';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
    const app: Application = express();

    // Trust proxy (important for rate limiting and IP detection behind reverse proxy)
    app.set('trust proxy', 1);

    // Security middleware
    app.use(helmetMiddleware);
    app.use(corsMiddleware);

    // Correlation ID for request tracking
    app.use(correlationIdMiddleware);

    // Body parsing middleware with size limits
    app.use(express.json({
        limit: '10mb',
        verify: (req: any, _res, buf) => {
            req.rawBody = buf.toString();
        }
    }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request size validation (additional layer)
    app.use(requestSizeValidator(10240)); // 10MB limit

    // XSS protection
    app.use(xssProtection);

    // --- PUBLIC ROUTES (No Security/Encryption) ---

    // Root route (Dynamic Health Check)
    app.get('/', async (_req: Request, res: Response) => {
        const dbConnected = await testConnection();
        res.status(dbConnected ? 200 : 503).json({
            success: dbConnected,
            message: dbConnected ? 'n8n Dashboard API Server is online' : 'Server is starting or experiencing issues',
            database: dbConnected ? 'connected' : 'disconnected',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        });
    });

    // API root route (Public Info)
    app.get('/api', async (_req: Request, res: Response) => {
        const dbConnected = await testConnection();
        res.status(dbConnected ? 200 : 503).json({
            success: dbConnected,
            message: 'n8n Dashboard API is active',
            status: dbConnected ? 'healthy' : 'degraded',
            endpoints: {
                health: '/api/health',
                auth: '/api/auth'
            },
            version: '1.0.0'
        });
    });

    // Health check endpoint (Public)
    app.get('/api/health', async (_req: Request, res: Response<HealthCheckResponse>) => {
        const dbConnected = await testConnection();
        const n8nReachable = await n8nService.testConnectivity();

        const status: HealthCheckResponse = {
            status: dbConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbConnected ? 'connected' : 'disconnected',
            n8nConnectivity: n8nReachable ? 'reachable' : 'unreachable',
        };

        const statusCode = status.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(status);
    });

    // --- SECURE ROUTES (/api prefix) ---

    // 1. API Key validation (Global for /api)
    app.use('/api', validateApiKey);

    // 2. Response/Request Encryption (AES-256-GCM)
    app.use('/api', encryptionMiddleware);

    // Request logging
    if (process.env.NODE_ENV !== 'test') {
        const morganFormat = ':method :url :status :res[content-length] - :response-time ms';
        app.use(morgan(morganFormat, {
            stream: {
                write: (message: string) => logger.info(message.trim()),
            },
        }));
    }

    // Apply rate limiting to API routes
    app.use('/api/', apiLimiter);

    // Mount API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/agents', agentRoutes);
    app.use('/api/logs', logRoutes);
    app.use('/api/sse', sseRoutes);
    app.use('/api/forms', formRoutes);
    app.use('/api/stats', statsRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/chat', chatbotRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/n8n-logs', n8nLogsRoutes);
    app.use('/api/n8n-proxy', n8nProxyRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/support', supportRoutes);
    app.use('/api/notifications', notificationRoutes);

    // 404 handler
    app.use(notFoundHandler);

    // Global error handler (must be last)
    app.use(errorHandler);

    return app;
}
