import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { verifyToken } from '../utils/encryption';

export class SocketService {
    private io: SocketIOServer | null = null;

    initialize(httpServer: HttpServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: '*', // Configure this properly in production
                methods: ['GET', 'POST']
            }
        });

        this.io.use((socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication error'));
                }
                const decoded = verifyToken(token);
                socket.data.user = decoded;
                next();
            } catch (err) {
                next(new Error('Authentication error'));
            }
        });

        this.io.on('connection', (socket: Socket) => {
            const userId = socket.data.user.userId;
            logger.info(`User connected to WebSocket: ${userId}`);

            // Join user-specific room
            socket.join(`user_${userId}`);

            socket.on('disconnect', () => {
                logger.info(`User disconnected from WebSocket: ${userId}`);
            });
        });

        logger.info('✅ Socket.IO initialized');
    }

    // Method to emit events to specific users
    emitToUser(userId: string, event: string, data: any) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit(event, data);
        }
    }
}

export const socketService = new SocketService();
