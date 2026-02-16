import { z } from 'zod';

// Agent Status Enum
export enum AgentStatus {
    Idle = 'Idle',
    Scheduled = 'Scheduled',
    Running = 'Running',
    Completed = 'Completed',
    Error = 'Error',
    Cancelled = 'Cancelled',
}

// Agent interface
export interface Agent {
    id: string;
    userId: string;
    name: string;
    webhookUrl: string;
    schedule: string | null;
    status: AgentStatus;
    method: 'GET' | 'POST';
    inputPayload: string | null;
    lastRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// Create Agent schema for validation
export const createAgentSchema = z.object({
    name: z.string().min(1).max(255),
    webhookUrl: z.string().url(),
    schedule: z.string().optional().nullable(), // Relaxed to allow ISO strings from frontend
    method: z.enum(['GET', 'POST']).optional().default('POST'),
    inputPayload: z.string().optional().nullable(),
});

// Update Agent schema
export const updateAgentSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    webhookUrl: z.string().url().optional(),
    schedule: z.string().optional().nullable(),
    status: z.nativeEnum(AgentStatus).optional(),
    method: z.enum(['GET', 'POST']).optional(),
    inputPayload: z.string().optional().nullable(),
});

// Agent DTO (Data Transfer Object)
export type CreateAgentDTO = z.infer<typeof createAgentSchema>;
export type UpdateAgentDTO = z.infer<typeof updateAgentSchema>;

// Agent response (without sensitive data)
export type AgentResponse = Omit<Agent, 'userId'>;
