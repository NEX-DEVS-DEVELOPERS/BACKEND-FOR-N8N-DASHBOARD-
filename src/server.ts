import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initializeDatabase, testConnection } from './config/database';
import { authController } from './controllers/authController';

/**
 * Start the server
 */
async function startServer() {
    try {
        logger.info('🚀 Starting n8n Dashboard Backend...');

        // Test database connection
        logger.info('Testing Neon DB connection...');
        const dbConnected = await testConnection();
        if (!dbConnected) {
            throw new Error('Failed to connect to Neon DB');
        }

        // Initialize database schema
        logger.info('Initializing database schema...');
        await initializeDatabase();

        // Sync users from environment variables
        logger.info('Syncing users from environment variables...');
        await authController.syncUsersFromEnv();


        // Create Express app
        const app = createApp();

        // Start listening
        const server = app.listen(env.PORT, env.HOST, () => {
            logger.info(`✅ Server running on http://${env.HOST}:${env.PORT}`);
            logger.info(`Environment: ${env.NODE_ENV}`);
            logger.info(`API Docs: http://${env.HOST}:${env.PORT}/api/health`);
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal: string) => {
            logger.info(`\n${signal} received, shutting down gracefully...`);

            // Close server
            server.close(async () => {
                logger.info('HTTP server closed');

                logger.info('✅ Graceful shutdown complete');
                process.exit(0);
            });

            // Force close after 10 seconds
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        return server;
    } catch (error) {
        logger.error('❌ Fatal error starting server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
