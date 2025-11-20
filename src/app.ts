import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import { helmetMiddleware, corsMiddleware, xssProtection } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth.routes';
import agentRoutes from './routes/agents.routes';
import logRoutes from './routes/logs.routes';
import sseRoutes from './routes/sse.routes';
import formRoutes from './routes/forms.routes';
import statsRoutes from './routes/stats.routes';
import adminRoutes from './routes/admin.routes';
import settingsRoutes from './routes/settings.routes';

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

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // XSS protection
    app.use(xssProtection);

    // Request logging
    if (process.env.NODE_ENV !== 'test') {
        app.use(morgan('combined', {
            stream: {
                write: (message: string) => logger.info(message.trim()),
            },
        }));
    }

    // Health check endpoint (no rate limiting)
    app.get('/api/health', async (req: Request, res: Response<HealthCheckResponse>) => {
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

    // 404 handler
    app.use(notFoundHandler);

    // Global error handler (must be last)
    app.use(errorHandler);

    return app;
}
