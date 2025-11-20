import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * n8n Service - Client for interacting with n8n webhooks and API
 */
export class N8nService {
    private axiosInstance;

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: env.N8N_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                ...(env.N8N_API_KEY && { 'X-N8N-API-KEY': env.N8N_API_KEY }),
            },
        });
    }

    /**
     * Trigger an n8n workflow via webhook
     * @param webhookUrl Webhook URL
     * @param payload Data to send
     * @returns Response from n8n including SSE URL
     */
    async triggerWebhook(
        webhookUrl: string,
        payload: any
    ): Promise<{ sseUrl: string;[key: string]: any }> {
        try {
            logger.info('Triggering n8n webhook:', { webhookUrl });

            const response = await this.axiosInstance.post(webhookUrl, {
                ...payload,
                triggeredBy: 'n8n-dashboard-backend',
                timestamp: new Date().toISOString(),
            });

            // Validate response contains SSE URL
            if (!response.data || typeof response.data.sseUrl !== 'string') {
                throw new Error(
                    'Invalid n8n response: Missing sseUrl field. Ensure your n8n workflow returns { "sseUrl": "..." }'
                );
            }

            logger.info('n8n webhook triggered successfully:', {
                webhookUrl,
                sseUrl: response.data.sseUrl,
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                logger.error('n8n webhook error:', {
                    webhookUrl,
                    status: error.response?.status,
                    message: error.message,
                    data: error.response?.data,
                });

                throw new Error(
                    `Failed to trigger n8n webhook: ${error.message} (Status: ${error.response?.status || 'N/A'})`
                );
            }

            logger.error('Unexpected error triggering webhook:', error);
            throw new Error('Failed to trigger n8n webhook');
        }
    }

    /**
     * Test connectivity to n8n instance
     * @returns True if reachable
     */
    async testConnectivity(): Promise<boolean> {
        try {
            // Attempt a simple request to n8n base URL
            await axios.get(env.N8N_BASE_URL, { timeout: 5000 });
            return true;
        } catch (error) {
            logger.warn('n8n connectivity test failed:', error);
            return false;
        }
    }
}

export const n8nService = new N8nService();
