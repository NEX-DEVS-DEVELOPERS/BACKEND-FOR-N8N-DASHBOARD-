import { Response } from 'express';
import EventSource from 'eventsource';
import { logger } from '../utils/logger';
import { LogType, SSELogEvent } from '../types/log.types';

/**
 * SSE Manager - Manages Server-Sent Events connections
 */
export class SSEManager {
    private connections: Map<string, Set<Response>> = new Map();
    private n8nConnections: Map<string, EventSource> = new Map();

    /**
     * Subscribe a client to a session
     * @param sessionId Session ID
     * @param res Express response object
     */
    subscribe(sessionId: string, res: Response): void {
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        });

        // Add to connections map
        if (!this.connections.has(sessionId)) {
            this.connections.set(sessionId, new Set());
        }
        this.connections.get(sessionId)!.add(res);

        logger.info('SSE client subscribed:', { sessionId });

        // Send initial connection message
        this.sendEvent(res, 'connected', { message: 'Connected to log stream' });

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
            this.sendEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
        }, 30000); // Every 30 seconds

        // Handle client disconnect
        res.on('close', () => {
            clearInterval(heartbeatInterval);
            this.unsubscribe(sessionId, res);
        });
    }

    /**
     * Unsubscribe a client from a session
     * @param sessionId Session ID
     * @param res Express response object
     */
    unsubscribe(sessionId: string, res: Response): void {
        const clients = this.connections.get(sessionId);
        if (clients) {
            clients.delete(res);
            if (clients.size === 0) {
                this.connections.delete(sessionId);
                logger.info('All clients disconnected, cleaning up session:', {
                    sessionId,
                });
            }
        }
    }

    /**
     * Broadcast an event to all clients in a session
     * @param sessionId Session ID
     * @param eventType Event type
     * @param data Event data
     */
    broadcast(sessionId: string, eventType: string, data: any): void {
        const clients = this.connections.get(sessionId);
        if (!clients || clients.size === 0) {
            logger.debug('No clients to broadcast to:', { sessionId });
            return;
        }

        logger.debug('Broadcasting event:', { sessionId, eventType, clientCount: clients.size });

        clients.forEach((client) => {
            this.sendEvent(client, eventType, data);
        });
    }

    /**
     * Send an SSE event to a specific client
     * @param res Express response
     * @param eventType Event type
     * @param data Event data
     */
    private sendEvent(res: Response, eventType: string, data: any): void {
        try {
            const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
            res.write(message);
        } catch (error) {
            logger.error('Error sending SSE event:', { eventType, error });
        }
    }

    /**
     * Connect to n8n SSE stream and proxy events to frontend clients
     * @param n8nSseUrl n8n SSE URL
     * @param sessionId Session ID
     */
    async connectToN8nStream(n8nSseUrl: string, sessionId: string): Promise<void> {
        try {
            logger.info('Connecting to n8n SSE stream:', { sessionId, n8nSseUrl });

            const eventSource = new EventSource(n8nSseUrl);
            this.n8nConnections.set(sessionId, eventSource);

            eventSource.onopen = () => {
                logger.info('n8n SSE connection established:', { sessionId });
                this.broadcast(sessionId, 'log', {
                    type: LogType.Success,
                    message: 'Connected to agent workflow stream',
                });
            };

            eventSource.onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    logger.debug('Received n8n SSE event:', { sessionId, data });

                    // Check for control messages
                    if (data.type === 'control') {
                        if (data.message === 'COMPLETE') {
                            this.broadcast(sessionId, 'complete', { status: 'Completed' });
                            eventSource.close();
                            this.n8nConnections.delete(sessionId);
                            return;
                        } else if (data.message === 'ERROR') {
                            this.broadcast(sessionId, 'error', { message: 'Workflow failed' });
                            eventSource.close();
                            this.n8nConnections.delete(sessionId);
                            return;
                        }
                    }

                    // Forward log events
                    if (Object.values(LogType).includes(data.type)) {
                        this.broadcast(sessionId, 'log', data);
                    }
                } catch (error) {
                    logger.error('Error parsing n8n SSE event:', { sessionId, error, data: event.data });
                    this.broadcast(sessionId, 'log', {
                        type: LogType.Error,
                        message: `Failed to parse event: ${event.data}`,
                    });
                }
            };

            eventSource.onerror = (error: any) => {
                logger.error('n8n SSE connection error:', { sessionId, error });
                this.broadcast(sessionId, 'log', {
                    type: LogType.Error,
                    message: 'Lost connection to workflow. The workflow may continue running on n8n.',
                });
                eventSource.close();
                this.n8nConnections.delete(sessionId);
            };
        } catch (error) {
            logger.error('Failed to connect to n8n SSE:', { sessionId, error });
            throw new Error('Failed to establish connection to workflow stream');
        }
    }

    /**
     * Stop n8n SSE connection for a session
     * @param sessionId Session ID
     */
    stopN8nStream(sessionId: string): void {
        const eventSource = this.n8nConnections.get(sessionId);
        if (eventSource) {
            eventSource.close();
            this.n8nConnections.delete(sessionId);
            logger.info('n8n SSE stream stopped:', { sessionId });
        }
    }

    /**
     * Get active session count
     * @returns Number of active sessions
     */
    getActiveSessionCount(): number {
        return this.connections.size;
    }

    /**
     * Get client count for a session
     * @param sessionId Session ID
     * @returns Number of connected clients
     */
    getSessionClientCount(sessionId: string): number {
        return this.connections.get(sessionId)?.size || 0;
    }
}

export const sseManager = new SSEManager();
