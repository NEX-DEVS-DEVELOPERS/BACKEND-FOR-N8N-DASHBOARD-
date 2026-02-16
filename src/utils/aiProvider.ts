import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModel } from 'ai';
import { env } from '../config/env';
import { logger } from './logger';

// Initialize providers
const google = createGoogleGenerativeAI({
    apiKey: env.GEMINI_API_KEY,
});

const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY,
});

export type ModelProvider = 'gemini' | 'openrouter';

interface AIModelConfig {
    provider: ModelProvider;
    modelId: string;
}

export class AIProvider {
    /**
     * Get the appropriate model based on availability and preference
     */
    getModel(modelName: string, provider: ModelProvider = 'openrouter'): LanguageModel {
        try {
            if (provider === 'gemini') {
                return google(modelName);
            } else if (provider === 'openrouter') {
                return openrouter.chat(modelName);
            }
            // Default to Direct Gemini API (free) if something goes wrong
            return google('gemini-2.0-flash-exp');
        } catch (error) {
            logger.error(`Error selecting model ${modelName} from ${provider}:`, error);
            // Fallback to direct Gemini (truly free)
            return google('gemini-2.0-flash-exp');
        }
    }

    /**
     * Get a fallback model if the primary fails
     * Prioritizes truly free options (direct Gemini API) to avoid credit issues
     */
    getFallbackModel(): LanguageModel {
        // First fallback: Direct Gemini API (truly free, no credits needed)
        if (env.GEMINI_API_KEY) {
            return google('gemini-2.0-flash-exp');
        }
        // Second fallback: OpenRouter with Gemini 2.0 Flash (requires credits)
        return openrouter.chat('google/gemini-2.0-flash-001');
    }

    /**
     * Determine best model logic based on user plan (centralized logic)
     * FREE TIER: Uses direct Gemini API (no OpenRouter credits needed)
     * PAID TIERS: Use OpenRouter for advanced models
     */
    getModelForPlan(userPlan: string): AIModelConfig {
        switch (userPlan.toLowerCase()) {
            case 'enterprise':
                return {
                    provider: 'openrouter',
                    modelId: 'anthropic/claude-3-5-sonnet',
                };
            case 'pro':
                return {
                    provider: 'openrouter',
                    modelId: 'google/gemini-2.0-pro-exp-02-05:free',
                };
            default:
                // FREE TIER: Use direct Gemini API to avoid OpenRouter credit issues
                return {
                    provider: 'gemini',
                    modelId: 'gemini-2.0-flash-exp', // Truly free via Google's API
                };
        }
    }
}

export const aiProvider = new AIProvider();
