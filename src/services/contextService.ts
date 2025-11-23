import { Agent, LogEntry } from '../types';
import { logger } from '../utils/logger';
import { PlanTier } from '../types/user.types';

/**
 * System context for AI model
 */
export interface SystemContext {
    agents: Array<{
        name: string;
        status: string;
        schedule?: string;
        lastRun?: string;
    }>;
    recentLogs: Array<{
        timestamp: string;
        type: string;
        message: string;
    }>;
    systemStats: {
        totalAgents: number;
        activeAgents: number;
        errorCount: number;
        lastError?: string;
    };
    userPlan: PlanTier;
}

/**
 * Context Service for building rich AI context
 * Aggregates system state, logs, and user data for better AI responses
 */
export class ContextService {
    private maxHistoryLength: number;
    private maxContextSize: number; // Maximum characters for context

    constructor() {
        this.maxHistoryLength = parseInt(process.env.MAX_HISTORY_LENGTH || '20');
        this.maxContextSize = 4000; // Leave room for user query and system instruction
    }

    /**
     * Build comprehensive system context for AI
     */
    buildSystemContext(
        agents: Agent[],
        logs: LogEntry[],
        userPlan: PlanTier
    ): SystemContext {
        // Process agents
        const agentContext = agents.map(agent => ({
            name: agent.name,
            status: agent.status,
            schedule: agent.schedule,
            lastRun: agent.lastRun
        }));

        // Process logs - prioritize errors and warnings
        const prioritizedLogs = this.prioritizeLogs(logs);
        const recentLogs = prioritizedLogs.slice(0, 10).map(log => ({
            timestamp: log.timestamp.toLocaleTimeString(),
            type: log.type,
            message: log.message
        }));

        // Calculate system stats
        const activeAgents = agents.filter(a => a.status === 'active').length;
        const errorLogs = logs.filter(l => l.type === 'error');
        const lastError = errorLogs.length > 0 ? errorLogs[errorLogs.length - 1].message : undefined;

        return {
            agents: agentContext,
            recentLogs,
            systemStats: {
                totalAgents: agents.length,
                activeAgents,
                errorCount: errorLogs.length,
                lastError
            },
            userPlan
        };
    }

    /**
     * Format context for AI model consumption
     */
    formatContextForAI(context: SystemContext, includeFullDetails: boolean = false): string {
        let formatted = '--- SYSTEM CONTEXT ---\n\n';

        // User Plan
        formatted += `**User Plan**: ${context.userPlan.toUpperCase()}\n\n`;

        // System Stats
        formatted += '**System Overview**:\n';
        formatted += `- Total Agents: ${context.systemStats.totalAgents}\n`;
        formatted += `- Active Agents: ${context.systemStats.activeAgents}\n`;
        formatted += `- Recent Errors: ${context.systemStats.errorCount}\n`;
        if (context.systemStats.lastError) {
            formatted += `- Last Error: ${this.truncate(context.systemStats.lastError, 100)}\n`;
        }
        formatted += '\n';

        // Agents
        if (context.agents.length > 0 && includeFullDetails) {
            formatted += '**Current Agents**:\n';
            context.agents.slice(0, 5).forEach(agent => {
                formatted += `- ${agent.name}: ${agent.status}`;
                if (agent.schedule) {
                    formatted += ` (Schedule: ${agent.schedule})`;
                }
                formatted += '\n';
            });
            formatted += '\n';
        }

        // Recent Logs
        if (context.recentLogs.length > 0) {
            formatted += '**Recent Activity**:\n';
            context.recentLogs.slice(0, 5).forEach(log => {
                formatted += `[${log.timestamp}] [${log.type.toUpperCase()}] ${this.truncate(log.message, 150)}\n`;
            });
        }

        formatted += '\n--- END CONTEXT ---\n';

        // Ensure context doesn't exceed max size
        if (formatted.length > this.maxContextSize) {
            formatted = formatted.substring(0, this.maxContextSize) + '\n... (context truncated)';
        }

        return formatted;
    }

    /**
     * Prioritize logs by importance (errors first, then warnings, then info)
     */
    private prioritizeLogs(logs: LogEntry[]): LogEntry[] {
        const errors = logs.filter(l => l.type === 'error');
        const warnings = logs.filter(l => l.type === 'warning');
        const info = logs.filter(l => l.type === 'info');

        return [...errors, ...warnings, ...info];
    }

    /**
     * Extract relevant context based on user query
     */
    extractRelevantContext(
        fullContext: SystemContext,
        userQuery: string
    ): SystemContext {
        const lowerQuery = userQuery.toLowerCase();

        // If query mentions specific agent, filter logs for that agent
        const mentionedAgent = fullContext.agents.find(agent =>
            lowerQuery.includes(agent.name.toLowerCase())
        );

        if (mentionedAgent) {
            const relevantLogs = fullContext.recentLogs.filter(log =>
                log.message.toLowerCase().includes(mentionedAgent.name.toLowerCase())
            );

            return {
                ...fullContext,
                agents: [mentionedAgent],
                recentLogs: relevantLogs.length > 0 ? relevantLogs : fullContext.recentLogs
            };
        }

        // If query is about errors, prioritize error logs
        if (lowerQuery.includes('error') || lowerQuery.includes('fail') || lowerQuery.includes('issue')) {
            const errorLogs = fullContext.recentLogs.filter(log => log.type === 'error');

            return {
                ...fullContext,
                recentLogs: errorLogs.length > 0 ? errorLogs : fullContext.recentLogs
            };
        }

        // Return full context if no specific filtering needed
        return fullContext;
    }

    /**
     * Build context string for user query
     */
    buildContextString(
        agents: Agent[],
        logs: LogEntry[],
        userPlan: PlanTier,
        userQuery: string
    ): string {
        const fullContext = this.buildSystemContext(agents, logs, userPlan);
        const relevantContext = this.extractRelevantContext(fullContext, userQuery);

        // For Pro and Enterprise, include full details
        const includeFullDetails = userPlan === 'pro' || userPlan === 'enterprise';

        return this.formatContextForAI(relevantContext, includeFullDetails);
    }

    /**
     * Prune conversation history to fit within limits
     */
    pruneHistory(
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        maxLength?: number
    ): Array<{ role: 'user' | 'assistant'; content: string }> {
        const limit = maxLength || this.maxHistoryLength;

        if (history.length <= limit) {
            return history;
        }

        // Keep most recent messages
        return history.slice(-limit);
    }

    /**
     * Estimate token count (rough approximation)
     */
    estimateTokens(text: string): number {
        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }

    /**
     * Truncate text to specified length
     */
    private truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Check if context is too large
     */
    isContextTooLarge(context: string): boolean {
        return this.estimateTokens(context) > 2000; // Conservative limit
    }

    /**
     * Compress context by removing less important information
     */
    compressContext(context: string): string {
        // Remove extra whitespace
        let compressed = context.replace(/\n{3,}/g, '\n\n');
        compressed = compressed.replace(/ {2,}/g, ' ');

        // If still too large, remove log details
        if (this.estimateTokens(compressed) > 2000) {
            compressed = compressed.replace(/Recent Activity:[\s\S]*?---/g, '---');
        }

        return compressed;
    }

    /**
     * Generate context summary for analytics
     */
    generateContextSummary(context: SystemContext): string {
        return `Plan: ${context.userPlan} | Agents: ${context.systemStats.totalAgents} (${context.systemStats.activeAgents} active) | Errors: ${context.systemStats.errorCount}`;
    }

    /**
     * Detect if query requires system context
     */
    requiresSystemContext(query: string): boolean {
        const contextKeywords = [
            'agent', 'workflow', 'error', 'log', 'status', 'running',
            'active', 'schedule', 'trigger', 'execution', 'my', 'current'
        ];

        const lowerQuery = query.toLowerCase();
        return contextKeywords.some(keyword => lowerQuery.includes(keyword));
    }

    /**
     * Build lightweight context for simple queries
     */
    buildLightweightContext(userPlan: PlanTier): string {
        return `User Plan: ${userPlan.toUpperCase()}`;
    }
}

// Export singleton instance
export const contextService = new ContextService();
