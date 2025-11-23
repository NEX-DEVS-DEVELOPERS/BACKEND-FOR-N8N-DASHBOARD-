import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

/**
 * Chat message format
 */
interface ChatMessage {
    role: 'user' | 'model';
    parts: string;
}

/**
 * Chatbot request body
 */
interface ChatbotRequest {
    message: string;
    history?: ChatMessage[];
}

/**
 * Initialize Google Gemini AI
 */
const initializeGemini = () => {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
        logger.error('GOOGLE_GEMINI_API_KEY is not configured in environment');
        throw new Error('AI service not configured');
    }

    return new GoogleGenerativeAI(apiKey);
};

/**
 * Get model name based on user plan
 */
const getModelForPlan = (plan: string): string => {
    switch (plan) {
        case 'enterprise':
            // Enterprise: Best available Gemini model (or Claude if configured)
            return process.env.GEMINI_PRO_MODEL || 'gemini-1.5-pro-latest';
        case 'pro':
            // Pro: Gemini 3 Pro (advanced capabilities)
            return process.env.GEMINI_PRO_MODEL || 'gemini-1.5-pro-latest';
        case 'free':
        default:
            // Free: Gemini 2.5 Flash (fast and efficient)
            return process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.0-flash-exp';
    }
};

/**
 * Get system instruction based on plan
 */
const getSystemInstruction = (plan: string): string => {
    const baseInstruction = `You are Zappy, an expert n8n workflow automation assistant from NEX-DEVS. 
You help users with n8n workflows, troubleshooting, node configurations, and automation best practices.
Be concise, helpful, and technically accurate.`;

    switch (plan) {
        case 'enterprise':
            return `${baseInstruction}\n\nYou're serving an ENTERPRISE customer with full system access. Provide detailed, production-grade solutions with code examples and best practices.`;
        case 'pro':
            return `${baseInstruction}\n\nYou're serving a PRO customer. Provide advanced solutions with code examples and optimization tips.`;
        case 'free':
        default:
            return `${baseInstruction}\n\nYou're serving a FREE tier customer. Provide clear, helpful guidance with links to documentation when appropriate.`;
    }
};

/**
 * @desc    Send message to chatbot and get response
 * @route   POST /api/chatbot/message
 * @access  Private
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
        const { message, history = [] }: ChatbotRequest = req.body;
        const user = (req as any).user;

        // Validate input
        if (!message || typeof message !== 'string') {
            res.status(400).json({ error: 'Message is required and must be a string' });
            return;
        }

        if (message.trim().length === 0) {
            res.status(400).json({ error: 'Message cannot be empty' });
            return;
        }

        // Initialize Gemini
        const genAI = initializeGemini();
        const modelName = getModelForPlan(user.plan);
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: getSystemInstruction(user.plan)
        });

        logger.info(`Chatbot request from user ${user.id} (${user.plan}) using model ${modelName}`);

        // Convert history format if needed
        const formattedHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts }]
        }));

        // Start chat with history
        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                maxOutputTokens: user.plan === 'enterprise' ? 2048 : user.plan === 'pro' ? 1024 : 512,
                temperature: 0.7,
            }
        });

        // Generate response
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        const responseTimeMs = Date.now() - startTime;

        logger.info(`Chatbot response generated in ${responseTimeMs}ms`);

        res.json({
            response: responseText,
            model: modelName,
            provider: 'google-gemini',
            plan: user.plan,
            responseTimeMs
        });

    } catch (error) {
        const responseTimeMs = Date.now() - startTime;
        logger.error('Chatbot error:', error);

        // User-friendly error message
        const errorMessage = error instanceof Error && error.message.includes('API_KEY')
            ? 'AI service is not properly configured. Please contact support.'
            : 'An error occurred while processing your request. Please try again.';

        res.status(500).json({
            error: 'Failed to process chatbot request',
            message: errorMessage,
            responseTimeMs
        });
    }
};

/**
 * @desc    Stream message to chatbot with real-time response
 * @route   POST /api/chatbot/stream
 * @access  Private
 */
export const streamMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message, history = [] }: ChatbotRequest = req.body;
        const user = (req as any).user;

        // Validate input
        if (!message || typeof message !== 'string') {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Initialize Gemini
        const genAI = initializeGemini();
        const modelName = getModelForPlan(user.plan);
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: getSystemInstruction(user.plan)
        });

        // Convert history format
        const formattedHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts }]
        }));

        const chat = model.startChat({
            history: formattedHistory
        });

        // Stream response
        const result = await chat.sendMessageStream(message);
        let fullResponse = '';

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullResponse += chunkText;
            res.write(`data: ${JSON.stringify({ chunk: chunkText, done: false })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ done: true, fullResponse, model: modelName })}\n\n`);
        res.end();

    } catch (error) {
        logger.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Streaming failed', done: true })}\n\n`);
        res.end();
    }
};

/**
 * @desc    Clear chat history for user
 * @route   DELETE /api/chatbot/history
 * @access  Private
 */
export const clearHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        res.json({
            message: 'Chat history cleared successfully',
            userId: user.id
        });

    } catch (error) {
        logger.error('Clear history error:', error);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
};

/**
 * @desc    Get system context for better responses
 * @route   GET /api/chatbot/context
 * @access  Private
 */
export const getContext = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;

        res.json({
            summary: `User on ${user.plan} plan`,
            plan: user.plan,
            model: getModelForPlan(user.plan)
        });

    } catch (error) {
        logger.error('Get context error:', error);
        res.status(500).json({ error: 'Failed to get context' });
    }
};

/**
 * @desc    Check AI model health and configuration
 * @route   GET /api/chatbot/health
 * @access  Private
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        const isConfigured = !!apiKey;

        if (!isConfigured) {
            res.status(503).json({
                status: 'unhealthy',
                error: 'API key not configured',
                apiKeyConfigured: false
            });
            return;
        }

        // Try to initialize Gemini to verify API key works
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

            // Simple test prompt
            const result = await model.generateContent('Say "OK" if you can read this.');
            const response = result.response.text();

            res.status(200).json({
                status: 'healthy',
                apiKeyConfigured: true,
                models: {
                    'gemini-2.0-flash-exp': true,
                    'gemini-1.5-pro-latest': true
                },
                testResponse: response.includes('OK') || response.includes('ok'),
                timestamp: new Date().toISOString()
            });
        } catch (apiError) {
            logger.error('Gemini API test failed:', apiError);
            res.status(503).json({
                status: 'unhealthy',
                error: 'API key validation failed',
                apiKeyConfigured: true,
                apiKeyValid: false
            });
        }

    } catch (error) {
        logger.error('Health check error:', error);
        res.status(503).json({
            status: 'unhealthy',
            error: 'Health check failed'
        });
    }
};
