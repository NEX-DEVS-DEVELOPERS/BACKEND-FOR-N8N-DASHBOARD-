import { Request, Response } from 'express';
import { query, querySingle } from '../config/database';
import { logger } from '../utils/logger';
import { ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';
import { v4 as uuidv4 } from 'uuid';
import { validateWebhookUrl } from '../utils/validators';

/**
 * N8n Proxy Controller
 * Handles proxying webhook calls to n8n to avoid CORS issues
 */
export class N8nProxyController {
    /**
     * Proxy webhook call to n8n
     * @route POST /api/n8n-proxy/trigger
     */
    async proxyWebhook(
        req: Request<{}, {}, { webhookUrl: string; agentId: string; userInput?: string }>,
        res: Response<ApiSuccessResponse<{ runId: string; message: string }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { webhookUrl: rawUrl, agentId, userInput, method = 'POST', payload } = req.body;
            const webhookUrl = rawUrl?.trim();

            if (!webhookUrl || !agentId) {
                res.status(400).json({
                    success: false,
                    error: 'webhookUrl and agentId are required',
                    statusCode: 400,
                });
                return;
            }

            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    statusCode: 401,
                });
                return;
            }

            // Create log session to track this run and associate with user
            let runId: string;
            try {
                const sessionResult = await querySingle<{ id: string }>(
                    `INSERT INTO log_sessions (user_id, agent_id, agent_name, status)
                     VALUES ($1, $2, (SELECT name FROM agents WHERE id = $2 LIMIT 1), 'Running')
                     RETURNING id`,
                    [req.user.userId, agentId]
                );
                runId = sessionResult?.id || uuidv4();
            } catch (err) {
                logger.error('Failed to create log session, falling back to UUID', err);
                runId = uuidv4();
            }

            const timestamp = new Date().toISOString();

            logger.info('Proxying webhook to n8n:', {
                webhookUrl,
                agentId,
                runId,
                method,
                userId: req.user.userId,
            });

            let n8nResponse;

            if (method === 'GET') {
                const url = new URL(webhookUrl);
                url.searchParams.append('run_id', runId);
                url.searchParams.append('agent_id', agentId);
                url.searchParams.append('user_id', req.user.userId);
                url.searchParams.append('timestamp', timestamp);
                if (userInput) url.searchParams.append('user_input', userInput);

                // Merge payload into query params
                if (payload && typeof payload === 'object') {
                    Object.entries(payload).forEach(([key, value]) => {
                        if (value !== undefined && value !== null) {
                            url.searchParams.append(key, String(value));
                        }
                    });
                }

                n8nResponse = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'n8n-dashboard-proxy/1.0',
                    }
                });

            } else {
                // POST (Default)
                const body = {
                    run_id: runId,
                    agent_id: agentId,
                    user_input: userInput || '', // Maintain backward compatibility
                    user_id: req.user.userId,
                    timestamp,
                    ...(payload || {}) // Merge payload
                };

                n8nResponse = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'n8n-dashboard-proxy/1.0',
                    },
                    body: JSON.stringify(body),
                });
            }

            if (!n8nResponse.ok) {
                const errorBody = await n8nResponse.text().catch(() => 'No response body');

                // Check for Method Mismatch (404 + "Did you mean to make a GET request?")
                if (n8nResponse.status === 404 && (errorBody.includes('Did you mean to make a GET request') || errorBody.includes('GET request'))) {
                    logger.info('Retrying webhook with GET method due to 404...', { webhookUrl });

                    try {
                        const url = new URL(webhookUrl);
                        url.searchParams.append('run_id', runId);
                        url.searchParams.append('agent_id', agentId);
                        if (userInput) url.searchParams.append('user_input', userInput);
                        url.searchParams.append('user_id', req.user.userId);
                        url.searchParams.append('timestamp', new Date().toISOString());

                        const getResponse = await fetch(url.toString(), {
                            method: 'GET',
                            headers: {
                                'User-Agent': 'n8n-dashboard-proxy/1.0',
                            }
                        });

                        if (getResponse.ok) {
                            logger.info('N8n webhook triggered successfully via GET retry:', {
                                runId,
                                agentId,
                            });

                            res.status(200).json({
                                success: true,
                                data: {
                                    runId,
                                    message: 'Webhook triggered successfully (via GET)',
                                },
                            });
                            return;
                        }

                        // If GET also fails
                        const getErrorBody = await getResponse.text().catch(() => 'No response body');
                        logger.error('N8n webhook GET retry failed:', {
                            status: getResponse.status,
                            statusText: getResponse.statusText,
                            responseBody: getErrorBody.slice(0, 500)
                        });

                        // Return the error from the GET attempt
                        res.status(getResponse.status).json({
                            success: false,
                            error: `N8n webhook failed (GET retry) with status ${getResponse.status}: ${getResponse.statusText}`,
                            statusCode: getResponse.status,
                        });
                        return;

                    } catch (getError) {
                        logger.error('Error during GET retry:', getError);
                    }
                }

                logger.error('N8n webhook failed:', {
                    status: n8nResponse.status,
                    statusText: n8nResponse.statusText,
                    webhookUrl,
                    responseBody: errorBody.slice(0, 500) // Log first 500 chars of error
                });

                let userErrorMessage = `N8n webhook failed with status ${n8nResponse.status}: ${n8nResponse.statusText}`;
                try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson.message) {
                        userErrorMessage = errorJson.message;
                        if (errorJson.hint) {
                            userErrorMessage += ` - Hint: ${errorJson.hint}`;
                        }
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }

                res.status(n8nResponse.status).json({
                    success: false,
                    error: userErrorMessage,
                    statusCode: n8nResponse.status,
                });
                return;
            }

            logger.info('N8n webhook triggered successfully:', {
                runId,
                agentId,
            });

            res.status(200).json({
                success: true,
                data: {
                    runId,
                    message: 'Webhook triggered successfully',
                },
            });
        } catch (error) {
            logger.error('Error proxying webhook to n8n:', error);

            const errorMessage =
                error instanceof Error ? error.message : 'Failed to proxy webhook';

            res.status(500).json({
                success: false,
                error: errorMessage,
                statusCode: 500,
            });
        }
    }

    /**
     * Test webhook connection
     * @route POST /api/n8n-proxy/test
     */
    async testWebhook(
        req: Request<{}, {}, { webhookUrl: string }>,
        res: Response<ApiSuccessResponse<{ message: string; latency: number }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { webhookUrl } = req.body;

            if (!webhookUrl) {
                res.status(400).json({
                    success: false,
                    error: 'webhookUrl is required',
                    statusCode: 400,
                });
                return;
            }

            // Check whitelist
            if (!validateWebhookUrl(webhookUrl)) {
                res.status(403).json({
                    success: false,
                    error: 'Invalid webhook URL or domain not whitelisted',
                    statusCode: 403,
                });
                return;
            }

            const startTime = Date.now();

            // Test webhook with OPTIONS or HEAD request
            const testResponse = await fetch(webhookUrl, {
                method: 'OPTIONS',
            });

            const latency = Date.now() - startTime;

            if (!testResponse.ok && testResponse.status !== 405) {
                // 405 is acceptable for OPTIONS
                res.status(testResponse.status).json({
                    success: false,
                    error: `Webhook test failed with status ${testResponse.status}`,
                    statusCode: testResponse.status,
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: {
                    message: 'Webhook is reachable',
                    latency,
                },
            });
        } catch (error) {
            logger.error('Error testing webhook:', error);

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to test webhook',
                statusCode: 500,
            });
        }
    }
}

export const n8nProxyController = new N8nProxyController();
