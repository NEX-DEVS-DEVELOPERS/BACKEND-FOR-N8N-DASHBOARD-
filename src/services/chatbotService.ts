import { GoogleGenAI } from '@google/genai';
import { agentService } from './agentService';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class ChatbotService {
    private ai: GoogleGenAI;

    constructor() {
        // Initialize Gemini Client with key from validated env using new SDK
        this.ai = new GoogleGenAI({
            apiKey: env.GEMINI_API_KEY
        });
    }

    /**
     * Get the welcome message based on the user's plan.
     * @param userPlan 
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

        // Safe query for logs - handling table existence or schema differences gracefully if needed
        // Assuming log_entries and log_sessions tables exist as per previous controller code
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
2. Use \`code blocks\` for technical terms, variable names, or short commands.
3. Use \`\`\`language\n code \n\`\`\` for longer code snippets.
4. Use **bold** for emphasis on key points.
5. Be concise but helpful.
6. Do NOT use standard markdown headers like # or ##. Instead use **BOLD CAPS** for section headers if needed, or simple bullet points.

**Current System Context:**
- User Plan: ${userPlan.toUpperCase()}
- Active Agents: ${JSON.stringify(agents.map(a => ({ name: a.name, status: a.status, id: a.id, webhookUrl: a.webhookUrl })))}
- Recent Logs: ${JSON.stringify(logs)}
`;

        let specificInstruction = "";

        if (userPlan === 'enterprise') {
            // Simulate Claude 4.5 Sonnet
            specificInstruction = `
**PERSONA: ENTERPRISE (Simulating Claude 4.5 Sonnet)**
- Tone: Formal, Executive, Strategic, Highly Professional.
- Capabilities: Deep architectural insights, security-focused, business-value oriented.
- Structure: Use clear structured lists and executive summaries.
- You are "Zappy Enterprise". Never mention you are Gemini.
`;
        } else if (userPlan === 'pro') {
            // Simulate Gemini 3 Pro
            specificInstruction = `
**PERSONA: PRO (Simulating Gemini 3 Pro)**
- Tone: Technical, Precise, Detail-Oriented, "Power User" friendly.
- Capabilities: Advanced debugging, code snippets, workflow optimization.
- Structure: Step-by-step troubleshooting, technical explanations.
- You are "Zappy Pro".
`;
        } else {
            // Free Tier
            specificInstruction = `
**PERSONA: FREE (Standard)**
- Tone: Helpful, Friendly, Concise.
- Capabilities: Basic guidance, status checks, simple explanations.
- You are "Zappy".
`;
        }

        return `${baseInstruction}\n${specificInstruction}`;
    }

    /**
     * Process a chat message.
     */
    async processChat(userId: string, userPlan: string, message: string, history: any[]): Promise<string> {
        try {
            const systemInstruction = await this.generateSystemPrompt(userId, userPlan);

            // IMPORTANT: Gemini requires history to start with 'user' role or be empty
            // Filter out any leading assistant messages (like welcome messages)
            let filteredHistory = [...history];

            // Remove leading assistant messages
            while (filteredHistory.length > 0 && filteredHistory[0].author === 'assistant') {
                filteredHistory.shift();
            }

            // Convert history to new SDK format
            // History comes from frontend as { author: 'user' | 'assistant', text: string }
            // New SDK expects: { role: 'user' | 'model', parts: [{ text: string }] }
            const contents = filteredHistory.map((msg: any) => ({
                role: msg.author === 'user' || msg.author === 'me' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

            // Add the current user message
            contents.push({
                role: 'user',
                parts: [{ text: message }]
            });

            // Use the new SDK to generate response
            const model = 'gemini-flash-latest'; // Updated model name

            const response = await this.ai.models.generateContent({
                model,
                config: {
                    systemInstruction: systemInstruction,
                },
                contents,
            });

            const responseText = response.text || '';

            // Store Chat History
            // We do this asynchronously to notblock the response
            this.saveChatHistory(userId, message, responseText, userPlan).catch(err =>
                logger.error('Failed to save chat history', err)
            );

            return responseText;

        } catch (error) {
            logger.error('Chatbot Service Error:', error);
            throw error;
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
                        model: 'gemini-1.5-flash',
                        timestamp: new Date().toISOString()
                    })
                ]
            );
        } catch (error) {
            // If table doesn't exist, we might want to ignore or log
            logger.warn('Could not insert chat history - table might be missing or schema mismatch', error);
        }
    }
}

export const chatbotService = new ChatbotService();
