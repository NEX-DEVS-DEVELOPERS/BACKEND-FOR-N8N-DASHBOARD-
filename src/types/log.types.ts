import { z } from 'zod';
import { AgentStatus } from './agent.types';

// Log Type Enum
export enum LogType {
    Info = 'Info',
    Success = 'Success',
    Error = 'Error',
    Control = 'Control',
}

// Log Entry interface
export interface LogEntry {
    id: string;
    sessionId: string;
    logType: LogType;
    message: string;
    timestamp: Date;
}

// Log Session interface
export interface LogSession {
    id: string;
    userId: string;
    agentId: string | null;
    agentName: string;
    status: AgentStatus;
    startedAt: Date;
    completedAt: Date | null;
    logs?: LogEntry[];
}

// Create log entry schema
export const createLogEntrySchema = z.object({
    sessionId: z.string().uuid(),
    logType: z.nativeEnum(LogType),
    message: z.string(),
});

// SSE Event types
export interface SSELogEvent {
    type: LogType;
    message: string;
}

export interface SSEStatusEvent {
    status: AgentStatus;
}

export interface SSECompleteEvent {
    message: 'COMPLETE' | 'ERROR';
}

// DTOs
export type CreateLogEntryDTO = z.infer<typeof createLogEntrySchema>;

// Log session response
export interface LogSessionResponse {
    id: string;
    agentId: string | null;
    agentName: string;
    status: AgentStatus;
    startedAt: string;
    completedAt: string | null;
    logs: Array<{
        type: LogType;
        message: string;
        timestamp: string;
    }>;
}
