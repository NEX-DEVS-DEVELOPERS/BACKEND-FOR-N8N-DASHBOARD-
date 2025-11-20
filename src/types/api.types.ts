// Standardized API response types

export interface ApiSuccessResponse<T = any> {
    success: true;
    data?: T;
    message?: string;
}

export interface ApiErrorResponse {
    success: false;
    error: string;
    details?: any;
    statusCode?: number;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Pagination
export interface PaginationParams {
    page: number;
    limit: number;
    offset: number;
}

export interface PaginatedResponse<T> {
    success: true;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Request with pagination
export interface PaginatedRequest {
    page?: string;
    limit?: string;
}

// Health check response (Redis removed)
export interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    database: 'connected' | 'disconnected';
    n8nConnectivity?: 'reachable' | 'unreachable';
}
