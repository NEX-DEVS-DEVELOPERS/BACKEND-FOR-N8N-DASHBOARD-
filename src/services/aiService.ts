import { GoogleGenerativeAI, GenerateContentResult, Content } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { PlanTier } from '../types/user.types';

/**
 * AI Model Supported Models
 */
export enum AIModel {
    GEMINI_FLASH = 'gemini-2.5-flash-002',
    GEMINI_PRO = 'gemini-3-pro',
    GPT_4O = 'gpt-4o',
    CLAUDE_SONNET = 'claude-3-5-sonnet-20241022'
}

/**
 * AI Service Configuration
 */
interface AIServiceConfig {
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    timeout?: number;
}

/**
 * AI Response with metadata
 */
export interface AIResponse {
    text: string;
    model: string;
    tokensUsed: number;
    inputTokens?: number;
    outputTokens?: number;
    responseTimeMs: number;
    wasCached: boolean;
    provider: 'gemini' | 'openai' | 'claude';
}

/**
 * Streaming chunk data
 */
export interface StreamChunk {
    text: string;
    done: boolean;
}

/**
 * Unified AI Service supporting multiple providers
 * Implements intelligent model selection and automatic fallback
 */
export class AIService {
    private geminiClient: GoogleGenerativeAI | null = null;
    private openaiClient: OpenAI | null = null;
    private claudeClient: Anthropic | null = null;

    private geminiConfig: AIServiceConfig;
    private geminiProConfig: AIServiceConfig;
    private openaiConfig: AIServiceConfig;
    private claudeConfig: AIServiceConfig;

    private enableFallback: boolean;
    private modelPriority: string[];
    private selectionStrategy: string;

    constructor() {
        // Initialize Gemini (Free tier model)
        this.geminiConfig = {
            apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
            model: process.env.GEMINI_DEFAULT_MODEL || AIModel.GEMINI_FLASH,
            maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '8192'),
            temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
            topP: parseFloat(process.env.GEMINI_TOP_P || '0.95'),
            topK: parseInt(process.env.GEMINI_TOP_K || '40'),
            timeout: parseInt(process.env.AI_API_TIMEOUT_MS || '30000')
        };

        // Initialize Gemini Pro (Pro tier model)
        this.geminiProConfig = {
            apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
            model: process.env.GEMINI_PRO_MODEL || AIModel.GEMINI_PRO,
            maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '8192'),
            temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
            topP: parseFloat(process.env.GEMINI_TOP_P || '0.95'),
            topK: parseInt(process.env.GEMINI_TOP_K || '40'),
            timeout: parseInt(process.env.AI_API_TIMEOUT_MS || '30000')
        };

        // Initialize OpenAI
        this.openaiConfig = {
            apiKey: process.env.OPENAI_API_KEY || '',
            model: process.env.OPENAI_MODEL || AIModel.GPT_4O,
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            topP: parseFloat(process.env.OPENAI_TOP_P || '0.95'),
            timeout: parseInt(process.env.AI_API_TIMEOUT_MS || '30000')
        };

        // Initialize Claude
        this.claudeConfig = {
            apiKey: process.env.ANTHROPIC_API_KEY || '',
            model: process.env.ANTHROPIC_MODEL || AIModel.CLAUDE_SONNET,
            maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
            temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            topP: parseFloat(process.env.ANTHROPIC_TOP_P || '0.95'),
            timeout: parseInt(process.env.AI_API_TIMEOUT_MS || '30000')
        };

        // Behavior settings
        this.enableFallback = process.env.ENABLE_MODEL_FALLBACK === 'true';
        this.modelPriority = (process.env.MODEL_PRIORITY || 'gemini,openai,claude').split(',');
        this.selectionStrategy = process.env.MODEL_SELECTION_STRATEGY || 'plan-based';

        // Initialize clients if API keys are available
        this.initializeClients();
    }

    /**
     * Initialize AI provider clients
     */
    private initializeClients(): void {
        try {
            if (this.geminiConfig.apiKey && this.geminiConfig.apiKey !== 'your-gemini-api-key-here') {
                this.geminiClient = new GoogleGenerativeAI(this.geminiConfig.apiKey);
                logger.info('Gemini AI client initialized');
            }

            if (this.openaiConfig.apiKey && this.openaiConfig.apiKey !== 'your-openai-api-key-here') {
                this.openaiClient = new OpenAI({ apiKey: this.openaiConfig.apiKey });
                logger.info('OpenAI client initialized');
            }

            if (this.claudeConfig.apiKey && this.claudeConfig.apiKey !== 'your-anthropic-api-key-here') {
                this.claudeClient = new Anthropic({ apiKey: this.claudeConfig.apiKey });
                logger.info('Claude AI client initialized');
            }

            if (!this.geminiClient && !this.openaiClient && !this.claudeClient) {
                logger.warn('No AI providers configured. Chatbot will not function.');
            }
        } catch (error) {
            logger.error('Error initializing AI clients:', error);
        }
    }

    /**
     * Select appropriate model based on user plan tier
     */
    private selectModelForPlan(plan: PlanTier): { provider: 'gemini' | 'openai' | 'claude', config: AIServiceConfig } {
        switch (this.selectionStrategy) {
            case 'plan-based':
                if (plan === 'enterprise') {
                    // Enterprise: Claude Sonnet 3.5
                    if (this.claudeClient) {
                        return { provider: 'claude', config: this.claudeConfig };
                    }
                } else if (plan === 'pro') {
                    // Pro: Gemini 3 Pro
                    if (this.geminiClient) {
                        return { provider: 'gemini', config: this.geminiProConfig };
                    }
                } else {
                    // Free: Gemini 2.5 Flash
                    if (this.geminiClient) {
                        return { provider: 'gemini', config: this.geminiConfig };
                    }
                }
                break;

            case 'performance-based':
                // Always use fastest model (Gemini Flash)
                if (this.geminiClient) {
                    return { provider: 'gemini', config: this.geminiConfig };
                }
                break;

            default:
                // Auto - same as plan-based
                if (this.geminiClient) {
                    return { provider: 'gemini', config: plan === 'pro' ? this.geminiProConfig : this.geminiConfig };
                }
        }

        // Fallback to first available provider
        if (this.geminiClient) return { provider: 'gemini', config: this.geminiConfig };
        if (this.openaiClient) return { provider: 'openai', config: this.openaiConfig };
        if (this.claudeClient) return { provider: 'claude', config: this.claudeConfig };

        throw new Error('No AI provider available');
    }

    /**
     * Generate completion using appropriate AI model
     */
    async generateCompletion(
        prompt: string,
        systemInstruction: string,
        plan: PlanTier,
        history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    ): Promise<AIResponse> {
        const startTime = Date.now();
        const { provider, config } = this.selectModelForPlan(plan);

        try {
            logger.info(`Generating completion with ${provider} (${config.model}) for plan: ${plan}`);

            switch (provider) {
                case 'gemini':
                    return await this.generateGeminiCompletion(prompt, systemInstruction, config, history, startTime);
                case 'openai':
                    return await this.generateOpenAICompletion(prompt, systemInstruction, config, history, startTime);
                case 'claude':
                    return await this.generateClaudeCompletion(prompt, systemInstruction, config, history, startTime);
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        } catch (error) {
            logger.error(`Error with ${provider} provider:`, error);

            // Attempt fallback if enabled
            if (this.enableFallback) {
                return await this.attemptFallback(prompt, systemInstruction, plan, history, provider, startTime);
            }

            throw error;
        }
    }

    /**
     * Generate completion using Google Gemini
     */
    private async generateGeminiCompletion(
        prompt: string,
        systemInstruction: string,
        config: AIServiceConfig,
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        startTime: number
    ): Promise<AIResponse> {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }

        const model = this.geminiClient.getGenerativeModel({
            model: config.model,
            systemInstruction,
        });

        // Convert history to Gemini format
        const geminiHistory: Content[] = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: geminiHistory,
            generationConfig: {
                maxOutputTokens: config.maxTokens,
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK
            }
        });

        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const text = response.text();

        return {
            text,
            model: config.model,
            tokensUsed: response.usageMetadata?.totalTokenCount || 0,
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
            responseTimeMs: Date.now() - startTime,
            wasCached: false,
            provider: 'gemini'
        };
    }

    /**
     * Generate completion using OpenAI GPT
     */
    private async generateOpenAICompletion(
        prompt: string,
        systemInstruction: string,
        config: AIServiceConfig,
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        startTime: number
    ): Promise<AIResponse> {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemInstruction },
            ...history.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
            })),
            { role: 'user', content: prompt }
        ];

        const completion = await this.openaiClient.chat.completions.create({
            model: config.model,
            messages,
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            top_p: config.topP
        });

        const text = completion.choices[0]?.message?.content || '';
        const usage = completion.usage;

        return {
            text,
            model: config.model,
            tokensUsed: usage?.total_tokens || 0,
            inputTokens: usage?.prompt_tokens || 0,
            outputTokens: usage?.completion_tokens || 0,
            responseTimeMs: Date.now() - startTime,
            wasCached: false,
            provider: 'openai'
        };
    }

    /**
     * Generate completion using Anthropic Claude
     */
    private async generateClaudeCompletion(
        prompt: string,
        systemInstruction: string,
        config: AIServiceConfig,
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        startTime: number
    ): Promise<AIResponse> {
        if (!this.claudeClient) {
            throw new Error('Claude client not initialized');
        }

        const messages: Anthropic.MessageParam[] = [
            ...history.map(msg => ({
                role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
                content: msg.content
            })),
            { role: 'user', content: prompt }
        ];

        const response = await this.claudeClient.messages.create({
            model: config.model,
            max_tokens: config.maxTokens || 4096,
            temperature: config.temperature,
            top_p: config.topP,
            system: systemInstruction,
            messages
        });

        const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
        const usage = response.usage;

        return {
            text,
            model: config.model,
            tokensUsed: usage.input_tokens + usage.output_tokens,
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            responseTimeMs: Date.now() - startTime,
            wasCached: false,
            provider: 'claude'
        };
    }

    /**
     * Attempt fallback to alternative AI provider
     */
    private async attemptFallback(
        prompt: string,
        systemInstruction: string,
        plan: PlanTier,
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        failedProvider: string,
        startTime: number
    ): Promise<AIResponse> {
        logger.warn(`Attempting fallback from ${failedProvider}`);

        const fallbackOrder = this.modelPriority.filter(p => p !== failedProvider);

        for (const providerName of fallbackOrder) {
            try {
                let config: AIServiceConfig;
                let provider: 'gemini' | 'openai' | 'claude';

                switch (providerName) {
                    case 'gemini':
                        if (!this.geminiClient) continue;
                        config = this.geminiConfig;
                        provider = 'gemini';
                        return await this.generateGeminiCompletion(prompt, systemInstruction, config, history, startTime);
                    case 'openai':
                        if (!this.openaiClient) continue;
                        config = this.openaiConfig;
                        provider = 'openai';
                        return await this.generateOpenAICompletion(prompt, systemInstruction, config, history, startTime);
                    case 'claude':
                        if (!this.claudeClient) continue;
                        config = this.claudeConfig;
                        provider = 'claude';
                        return await this.generateClaudeCompletion(prompt, systemInstruction, config, history, startTime);
                }
            } catch (error) {
                logger.error(`Fallback to ${providerName} failed:`, error);
                continue;
            }
        }

        throw new Error('All AI providers failed');
    }

    /**
     * Generate streaming completion
     */
    async* generateStreamingCompletion(
        prompt: string,
        systemInstruction: string,
        plan: PlanTier,
        history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    ): AsyncGenerator<StreamChunk> {
        const { provider, config } = this.selectModelForPlan(plan);

        logger.info(`Generating streaming completion with ${provider} (${config.model})`);

        if (provider === 'gemini' && this.geminiClient) {
            yield* this.streamGemini(prompt, systemInstruction, config, history);
        } else if (provider === 'openai' && this.openaiClient) {
            yield* this.streamOpenAI(prompt, systemInstruction, config, history);
        } else if (provider === 'claude' && this.claudeClient) {
            yield* this.streamClaude(prompt, systemInstruction, config, history);
        } else {
            throw new Error(`Streaming not supported for provider: ${provider}`);
        }
    }

    /**
     * Stream from Gemini
     */
    private async* streamGemini(
        prompt: string,
        systemInstruction: string,
        config: AIServiceConfig,
        history: Array<{ role: 'user' | 'assistant'; content: string }>
    ): AsyncGenerator<StreamChunk> {
        if (!this.geminiClient) throw new Error('Gemini client not initialized');

        const model = this.geminiClient.getGenerativeModel({
            model: config.model,
            systemInstruction
        });

        const geminiHistory: Content[] = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessageStream(prompt);

        for await (const chunk of result.stream) {
            const text = chunk.text();
            yield { text, done: false };
        }

        yield { text: '', done: true };
    }

    /**
     * Stream from OpenAI
     */
    private async* streamOpenAI(
        prompt: string,
        systemInstruction: string,
        config: AIServiceConfig,
        history: Array<{ role: 'user' | 'assistant'; content: string }>
    ): AsyncGenerator<StreamChunk> {
        if (!this.openaiClient) throw new Error('OpenAI client not initialized');

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemInstruction },
            ...history.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
            { role: 'user', content: prompt }
        ];

        const stream = await this.openaiClient.chat.completions.create({
            model: config.model,
            messages,
            stream: true,
            max_tokens: config.maxTokens,
            temperature: config.temperature
        });

        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) {
                yield { text, done: false };
            }
        }

        yield { text: '', done: true };
    }

    /**
     * Stream from Claude
     */
    private async* streamClaude(
        prompt: string,
        systemInstruction: string,
        config: AIServiceConfig,
        history: Array<{ role: 'user' | 'assistant'; content: string }>
    ): AsyncGenerator<StreamChunk> {
        if (!this.claudeClient) throw new Error('Claude client not initialized');

        const messages: Anthropic.MessageParam[] = [
            ...history.map(msg => ({
                role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
                content: msg.content
            })),
            { role: 'user', content: prompt }
        ];

        const stream = await this.claudeClient.messages.create({
            model: config.model,
            max_tokens: config.maxTokens || 4096,
            system: systemInstruction,
            messages,
            stream: true
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield { text: event.delta.text, done: false };
            }
        }

        yield { text: '', done: true };
    }

    /**
     * Check health of AI providers
     */
    async healthCheck(): Promise<{ [key: string]: boolean }> {
        const health: { [key: string]: boolean } = {};

        // Test Gemini
        if (this.geminiClient) {
            try {
                const model = this.geminiClient.getGenerativeModel({ model: this.geminiConfig.model });
                await model.generateContent('test');
                health.gemini = true;
            } catch {
                health.gemini = false;
            }
        }

        // Test OpenAI
        if (this.openaiClient) {
            try {
                await this.openaiClient.chat.completions.create({
                    model: this.openaiConfig.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 5
                });
                health.openai = true;
            } catch {
                health.openai = false;
            }
        }

        // Test Claude
        if (this.claudeClient) {
            try {
                await this.claudeClient.messages.create({
                    model: this.claudeConfig.model,
                    max_tokens: 5,
                    messages: [{ role: 'user', content: 'test' }]
                });
                health.claude = true;
            } catch {
                health.claude = false;
            }
        }

        return health;
    }
}

// Export singleton instance
export const aiService = new AIService();
