// Import env first to ensure variables are loaded
import { env } from './config/env';
import { createApp } from './app';
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

        // Create HTTP server
        const { createServer } = await import('http');
        const httpServer = createServer(app);

        // Initialize Socket.IO
        const { socketService } = await import('./services/socketService');
        socketService.initialize(httpServer);

        // Start listening
        const server = httpServer.listen(env.PORT, env.HOST, () => {
            console.log('\n' + '━'.repeat(50));
            logger.info(`🚀 SERVER ONLINE`);
            logger.info(`📡 URL: http://${env.HOST}:${env.PORT}`);
            logger.info(`🛠️  MODE: ${env.NODE_ENV}`);
            logger.info(`🏥 HEALTH: http://${env.HOST}:${env.PORT}/api/health`);
            console.log('━'.repeat(50) + '\n');
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
