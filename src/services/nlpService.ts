import { logger } from '../utils/logger';

/**
 * Intent categories for chatbot queries
 */
export enum Intent {
    TROUBLESHOOTING = 'troubleshooting',
    HOW_TO = 'how-to',
    FEATURE_REQUEST = 'feature-request',
    GENERAL_CHAT = 'general-chat',
    WORKFLOW_HELP = 'workflow-help',
    NODE_QUESTION = 'node-question',
    CREDENTIALS = 'credentials',
    PERFORMANCE = 'performance',
    INTEGRATION = 'integration',
    HUMAN_SUPPORT = 'human-support',
    UNKNOWN = 'unknown'
}

/**
 * Sentiment analysis results
 */
export enum Sentiment {
    POSITIVE = 'positive',
    NEUTRAL = 'neutral',
    NEGATIVE = 'negative',
    FRUSTRATED = 'frustrated'
}

/**
 * Entity types for n8n-specific terms
 */
export interface ExtractedEntity {
    type: 'workflow' | 'node' | 'credential' | 'webhook' | 'error' | 'integration';
    value: string;
    confidence: number;
}

/**
 * Intent detection result
 */
export interface IntentResult {
    intent: Intent;
    confidence: number;
    keywords: string[];
}

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
    sentiment: Sentiment;
    confidence: number;
    score: number; // -1 to 1
}

/**
 * Complete NLP analysis result
 */
export interface NLPAnalysis {
    intent: IntentResult;
    sentiment: SentimentResult;
    entities: ExtractedEntity[];
    enhancedQuery: string;
    language: string;
}

/**
 * NLP Service for chatbot query analysis
 * Provides intent detection, entity extraction, and sentiment analysis
 */
export class NLPService {
    private readonly intentKeywords: Record<Intent, string[]> = {
        [Intent.TROUBLESHOOTING]: [
            'error', 'issue', 'problem', 'broken', 'not working', 'failing', 'failed',
            'bug', 'crash', 'stuck', 'help', 'fix', 'debug', 'troubleshoot', 'wrong',
            'doesn\'t work', 'won\'t work', 'can\'t', 'unable', 'impossible'
        ],
        [Intent.HOW_TO]: [
            'how to', 'how do i', 'how can i', 'what is the way', 'tutorial',
            'guide', 'steps', 'instructions', 'setup', 'configure', 'create',
            'build', 'make', 'set up', 'explain', 'show me'
        ],
        [Intent.FEATURE_REQUEST]: [
            'feature', 'add', 'new', 'want', 'need', 'wish', 'could you',
            'would be nice', 'suggestion', 'enhancement', 'improve', 'better'
        ],
        [Intent.WORKFLOW_HELP]: [
            'workflow', 'automation', 'flow', 'process', 'sequence', 'trigger',
            'execution', 'run', 'activate', 'schedule', 'timing'
        ],
        [Intent.NODE_QUESTION]: [
            'node', 'module', 'function', 'action', 'operation', 'filter',
            'transform', 'send', 'receive', 'http request', 'code node'
        ],
        [Intent.CREDENTIALS]: [
            'credential', 'authentication', 'auth', 'api key', 'token', 'login',
            'password', 'oauth', 'permissions', 'access', 'connect'
        ],
        [Intent.PERFORMANCE]: [
            'slow', 'performance', 'speed', 'optimize', 'fast', 'timeout',
            'latency', 'delay', 'memory', 'cpu', 'resource', 'efficient'
        ],
        [Intent.INTEGRATION]: [
            'integration', 'connect', 'api', 'third party', 'service',
            'webhook', 'endpoint', 'external', 'platform'
        ],
        [Intent.HUMAN_SUPPORT]: [
            'talk to human', 'speak to support', 'contact', 'email', 'call',
            'representative', 'agent', 'person', 'speak to someone'
        ],
        [Intent.GENERAL_CHAT]: [
            'hello', 'hi', 'hey', 'thanks', 'thank you', 'bye', 'goodbye',
            'what', 'who', 'when', 'where', 'why'
        ],
        [Intent.UNKNOWN]: []
    };

    private readonly n8nNodes: string[] = [
        'HTTP Request', 'Webhook', 'Code', 'Set', 'IF', 'Switch', 'Merge', 'Split',
        'Google Sheets', 'Gmail', 'Slack', 'Discord', 'Telegram', 'Twitter',
        'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Airtable', 'Notion',
        'OpenAI', 'Anthropic', 'Google AI', 'HuggingFace', 'Pinecone',
        'AWS', 'Azure', 'Google Cloud', 'S3', 'Lambda', 'Function',
        'Crypto', 'Schedule Trigger', 'Cron', 'Wait', 'Error Trigger'
    ];

    private readonly errorPatterns: RegExp[] = [
        /error\s*(?:code\s*)?(\d+)/i,
        /(?:error|exception):\s*([^\n]+)/i,
        /failed\s*(?:to|with)?\s*([^\n]+)/i,
        /cannot\s+([^\n]+)/i,
        /unable\s+to\s+([^\n]+)/i
    ];

    private enableNLP: boolean;

    constructor() {
        this.enableNLP = process.env.ENABLE_NLP_PROCESSING === 'true';
    }

    /**
     * Perform complete NLP analysis on user query
     */
    analyze(query: string): NLPAnalysis {
        if (!this.enableNLP) {
            return {
                intent: { intent: Intent.UNKNOWN, confidence: 0, keywords: [] },
                sentiment: { sentiment: Sentiment.NEUTRAL, confidence: 0, score: 0 },
                entities: [],
                enhancedQuery: query,
                language: 'en'
            };
        }

        const intent = this.detectIntent(query);
        const sentiment = this.analyzeSentiment(query);
        const entities = this.extractEntities(query);
        const enhancedQuery = this.enhanceQuery(query, entities);
        const language = this.detectLanguage(query);

        logger.debug('NLP Analysis:', { intent, sentiment, entities: entities.length });

        return {
            intent,
            sentiment,
            entities,
            enhancedQuery,
            language
        };
    }

    /**
     * Detect user intent from query
     */
    private detectIntent(query: string): IntentResult {
        const lowerQuery = query.toLowerCase();
        const scores: Map<Intent, number> = new Map();

        // Calculate scores for each intent
        for (const [intent, keywords] of Object.entries(this.intentKeywords)) {
            let score = 0;
            const matchedKeywords: string[] = [];

            for (const keyword of keywords) {
                if (lowerQuery.includes(keyword.toLowerCase())) {
                    score += keyword.split(' ').length; // Multi-word phrases get higher weight
                    matchedKeywords.push(keyword);
                }
            }

            if (score > 0) {
                scores.set(intent as Intent, score);
            }
        }

        // Find intent with highest score
        if (scores.size === 0) {
            return {
                intent: Intent.UNKNOWN,
                confidence: 0,
                keywords: []
            };
        }

        const sortedIntents = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1]);

        const [topIntent, topScore] = sortedIntents[0];
        const totalScore = Array.from(scores.values()).reduce((sum, s) => sum + s, 0);
        const confidence = topScore / totalScore;

        const matchedKeywords = this.intentKeywords[topIntent].filter(
            k => lowerQuery.includes(k.toLowerCase())
        );

        return {
            intent: topIntent,
            confidence,
            keywords: matchedKeywords
        };
    }

    /**
     * Analyze sentiment of query
     */
    private analyzeSentiment(query: string): SentimentResult {
        const lowerQuery = query.toLowerCase();

        // Frustrated indicators (highest priority)
        const frustratedWords = [
            'frustrated', 'angry', 'terrible', 'awful', 'horrible', 'worst',
            'hate', 'stupid', 'ridiculous', 'useless', 'waste', 'broken again',
            'still not working', 'never works', 'always fails'
        ];

        // Negative indicators
        const negativeWords = [
            'not working', 'error', 'issue', 'problem', 'broken', 'failed', 'wrong',
            'bad', 'poor', 'difficult', 'hard', 'confused', 'stuck', 'can\'t'
        ];

        // Positive indicators
        const positiveWords = [
            'thank', 'thanks', 'great', 'good', 'excellent', 'awesome', 'perfect',
            'love', 'amazing', 'helpful', 'works', 'solved', 'fixed', 'easy'
        ];

        let score = 0;
        let sentiment = Sentiment.NEUTRAL;

        // Check frustrated
        const frustratedCount = frustratedWords.filter(w => lowerQuery.includes(w)).length;
        if (frustratedCount > 0) {
            score = -0.9 - (frustratedCount * 0.1);
            sentiment = Sentiment.FRUSTRATED;
        } else {
            // Check negative
            const negativeCount = negativeWords.filter(w => lowerQuery.includes(w)).length;
            const positiveCount = positiveWords.filter(w => lowerQuery.includes(w)).length;

            score = (positiveCount - negativeCount) * 0.2;

            if (score < -0.3) {
                sentiment = Sentiment.NEGATIVE;
            } else if (score > 0.3) {
                sentiment = Sentiment.POSITIVE;
            } else {
                sentiment = Sentiment.NEUTRAL;
            }
        }

        // Normalize score to -1 to 1 range
        score = Math.max(-1, Math.min(1, score));

        const confidence = Math.abs(score);

        return {
            sentiment,
            confidence,
            score
        };
    }

    /**
     * Extract n8n-specific entities from query
     */
    private extractEntities(query: string): ExtractedEntity[] {
        const entities: ExtractedEntity[] = [];

        // Extract node mentions
        for (const nodeName of this.n8nNodes) {
            const regex = new RegExp(`\\b${nodeName.replace(/\s+/g, '\\s+')}\\b`, 'gi');
            if (regex.test(query)) {
                entities.push({
                    type: 'node',
                    value: nodeName,
                    confidence: 0.9
                });
            }
        }

        // Extract error codes and messages
        for (const pattern of this.errorPatterns) {
            const match = query.match(pattern);
            if (match) {
                entities.push({
                    type: 'error',
                    value: match[1] || match[0],
                    confidence: 0.85
                });
            }
        }

        // Extract webhook mentions
        const webhookPattern = /webhook|hook|url|endpoint/gi;
        if (webhookPattern.test(query)) {
            entities.push({
                type: 'webhook',
                value: 'webhook',
                confidence: 0.7
            });
        }

        // Extract credential mentions
        const credPattern = /credential|api\s*key|token|auth|oauth|password/gi;
        if (credPattern.test(query)) {
            entities.push({
                type: 'credential',
                value: 'credential',
                confidence: 0.7
            });
        }

        // Extract integration/service mentions
        const integrationPattern = /google|slack|discord|telegram|twitter|github|gitlab|aws|azure|openai|anthropic/gi;
        const integrationMatches = query.match(integrationPattern);
        if (integrationMatches) {
            integrationMatches.forEach(match => {
                entities.push({
                    type: 'integration',
                    value: match,
                    confidence: 0.8
                });
            });
        }

        return entities;
    }

    /**
     * Enhance query with context and corrections
     */
    private enhanceQuery(query: string, entities: ExtractedEntity[]): string {
        let enhanced = query;

        // Expand common abbreviations
        const abbreviations: Record<string, string> = {
            'n8n': 'n8n workflow automation',
            'api': 'API (Application Programming Interface)',
            'http': 'HTTP Request',
            'cron': 'Cron Schedule',
            'oauth': 'OAuth authentication',
            'jwt': 'JWT (JSON Web Token)',
            'ssl': 'SSL/TLS encryption',
            'db': 'database',
            'env': 'environment variable'
        };

        for (const [abbr, full] of Object.entries(abbreviations)) {
            const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
            // Only expand on first occurrence to avoid repetition
            if (regex.test(enhanced) && !enhanced.includes(full)) {
                enhanced = enhanced.replace(regex, `${abbr} (${full})`);
                break; // Expand only one per query
            }
        }

        // Add context based on entities
        if (entities.length > 0) {
            const nodeEntities = entities.filter(e => e.type === 'node');
            if (nodeEntities.length > 0) {
                enhanced += ` [Context: User is asking about ${nodeEntities.map(e => e.value).join(', ')} node(s)]`;
            }

            const errorEntities = entities.filter(e => e.type === 'error');
            if (errorEntities.length > 0) {
                enhanced += ` [Error encountered: ${errorEntities[0].value}]`;
            }
        }

        return enhanced;
    }

    /**
     * Detect query language (basic implementation)
     */
    private detectLanguage(query: string): string {
        // Very basic language detection
        const commonEnglishWords = ['the', 'is', 'are', 'was', 'were', 'how', 'what', 'why', 'when', 'where'];
        const lowerQuery = query.toLowerCase();

        const englishWordCount = commonEnglishWords.filter(word =>
            lowerQuery.includes(` ${word} `) || lowerQuery.startsWith(`${word} `) || lowerQuery.endsWith(` ${word}`)
        ).length;

        // If multiple common English words found, assume English
        return englishWordCount >= 2 ? 'en' : 'unknown';
    }

    /**
     * Check if query requires human support
     */
    requiresHumanSupport(analysis: NLPAnalysis): boolean {
        return (
            analysis.intent.intent === Intent.HUMAN_SUPPORT ||
            (analysis.sentiment.sentiment === Sentiment.FRUSTRATED && analysis.sentiment.confidence > 0.7)
        );
    }

    /**
     * Generate context hints for AI model
     */
    generateContextHints(analysis: NLPAnalysis): string {
        const hints: string[] = [];

        // Add intent-based hints
        hints.push(`USER_INTENT: ${analysis.intent.intent}`);

        // Add sentiment-based hints
        if (analysis.sentiment.sentiment === Sentiment.FRUSTRATED) {
            hints.push('USER_MOOD: Frustrated - Use empathetic and patient tone');
        } else if (analysis.sentiment.sentiment === Sentiment.NEGATIVE) {
            hints.push('USER_MOOD: Concerned - Provide reassurance and clear solutions');
        }

        // Add entity-based hints
        if (analysis.entities.length > 0) {
            const entityTypes = [...new Set(analysis.entities.map(e => e.type))];
            hints.push(`RELEVANT_TOPICS: ${entityTypes.join(', ')}`);
        }

        return hints.join(' | ');
    }
}

// Export singleton instance
export const nlpService = new NLPService();
