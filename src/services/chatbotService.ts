import { streamText, ModelMessage } from 'ai';
import { aiProvider } from '../utils/aiProvider';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { agentService } from './agentService';

export class ChatbotService {

    /**
     * Get the welcome message based on the user's plan.
     */
    getWelcomeMessage(userPlan: string): string {
        switch (userPlan) {
            case 'enterprise':
                return "Hello. Zappy Enterprise initialized. I have your full system context loaded. How can I assist with your architectural or strategic needs today?";
            case 'pro':
                return "Hello! Zappy Pro here. Ready to optimize your workflows and debug any issues effectively.";
            default:
                return "Hello! I'm Zappy. How can I help you manage your n8n agents today?";
        }
    }

    /**
     * Generate the system prompt for the AI.
     */
    private async generateSystemPrompt(userId: string, userPlan: string): Promise<string> {
        // RAG: Fetch Context (Agents & Logs)
        const agents = await agentService.getUserAgents(userId);

        let logs: any[] = [];
        try {
            logs = await query(
                `SELECT log_type, message, timestamp FROM log_entries 
                 WHERE session_id IN (SELECT id FROM log_sessions WHERE user_id = $1) 
                 ORDER BY timestamp DESC LIMIT 10`,
                [userId]
            );
        } catch (err) {
            logger.warn("Could not fetch logs for chatbot context", err);
        }

        const baseInstruction = `You are Zappy, the dedicated AI support engineer for the N8N Agent Dashboard. 
Your goal is to help users manage their agents, debug workflows, and optimize performance.

**CRITICAL OUTPUT FORMATTING RULES:**
1. Use **Markdown** for all formatting.
2. Use \`code blocks\` for technical terms.
3. Use \`\`\`language\n code \n\`\`\` for code snippets.
4. Use **bold** for emphasis.
5. Be concise but helpful.

**Current System Context:**
- User Plan: ${userPlan.toUpperCase()}
- Active Agents: ${JSON.stringify(agents.map(a => ({ name: a.name, status: a.status, id: a.id, webhookUrl: a.webhookUrl })))}
- Recent Logs: ${JSON.stringify(logs)}
`;

        let specificInstruction = "";

        if (userPlan === 'enterprise') {
            specificInstruction = `
**PERSONA: ENTERPRISE**
- Tone: Formal, Executive, Strategic.
- Capabilities: Architectural insights, security-focused.
- You are "Zappy Enterprise".
`;
        } else if (userPlan === 'pro') {
            specificInstruction = `
**PERSONA: PRO**
- Tone: Technical, Precise, Power User friendly.
- Capabilities: Advanced debugging, optimization.
- You are "Zappy Pro".
`;
        } else {
            specificInstruction = `
**PERSONA: FREE (Standard)**
- Tone: Helpful, Friendly, Concise.
- You are "Zappy".
`;
        }

        return `${baseInstruction}\n${specificInstruction}`;
    }

    /**
     * Process a chat message using Vercel AI SDK streams.
     * Returns a streamable response.
     */
    async createChatStream(userId: string, userPlan: string, messages: ModelMessage[]): Promise<any> {
        try {
            const systemInstruction = await this.generateSystemPrompt(userId, userPlan);

            // Select model based on plan
            const modelConfig = aiProvider.getModelForPlan(userPlan);

            // Sanitize messages to ensure they match ModelMessage structure strictly
            const sanitizedMessages: ModelMessage[] = messages.map(m => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            }));

            // Get model from provider. Primary is now OpenRouter via aiProvider.
            let model = aiProvider.getModel(modelConfig.modelId, modelConfig.provider);

            // If Simulation Mode is ON, force direct Gemini API (free, no credits)
            if (env.MODEL_SIMULATION_MODE) {
                model = aiProvider.getModel('gemini-2.0-flash-exp', 'gemini');
            }

            // Create stream
            const result = await streamText({
                model: model,
                system: systemInstruction,
                messages: sanitizedMessages,
                maxOutputTokens: 800, // Reduced from 2000 to conserve OpenRouter credits and stay within free limits
                onFinish: async ({ text }) => {
                    // Save chat history after completion
                    // We get the last user message from the 'messages' array
                    const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content;
                    if (lastUserMessage && typeof lastUserMessage === 'string') {
                        await this.saveChatHistory(userId, lastUserMessage, text, userPlan);
                    }
                },
            });

            return result;

        } catch (error) {
            logger.error('Chatbot Stream Creation Error:', error);
            // Try fallback
            try {
                logger.info('Attempting fallback model...');
                const fallbackModel = aiProvider.getFallbackModel();
                const systemInstruction = await this.generateSystemPrompt(userId, userPlan);

                // Sanitize messages again or reuse
                const sanitizedMessages: ModelMessage[] = messages.map(m => ({
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                }));

                const result = await streamText({
                    model: fallbackModel,
                    system: systemInstruction,
                    messages: sanitizedMessages,
                    maxOutputTokens: 800, // Reduced to stay within free tier limits
                    onFinish: async ({ text }) => {
                        const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content;
                        if (lastUserMessage && typeof lastUserMessage === 'string') {
                            await this.saveChatHistory(userId, lastUserMessage, text, userPlan);
                        }
                    }
                });
                return result;
            } catch (fallbackError) {
                logger.error('Fallback failed:', fallbackError);
                throw error;
            }
        }
    }

    private async saveChatHistory(userId: string, message: string, response: string, userPlan: string) {
        try {
            await query(
                `INSERT INTO chat_history (user_id, message, response, metadata) 
                 VALUES ($1, $2, $3, $4)`,
                [
                    userId,
                    message,
                    response,
                    JSON.stringify({
                        plan: userPlan,
                        timestamp: new Date().toISOString(),
                        provider: 'vercel-ai-sdk'
                    })
                ]
            );
        } catch (error) {
            logger.warn('Could not insert chat history - table might be missing or schema mismatch', error);
        }
    }
}

export const chatbotService = new ChatbotService();
