import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiErrorResponse } from '../types/api.types';

/**
 * Middleware factory to validate request with Zod schema
 * @param schema Zod schema to validate against
 * @param source Request property to validate ('body', 'query', 'params')
 * @returns Express middleware
 */
export function validate(
    schema: ZodSchema,
    source: 'body' | 'query' | 'params' = 'body'
) {
    return (
        req: Request,
        res: Response<ApiErrorResponse>,
        next: NextFunction
    ): void => {
        try {
            // Validate request data
            const validated = schema.parse(req[source]);

            // Replace request data with validated data
            req[source] = validated;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.errors.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                    statusCode: 400,
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Invalid request data',
                    statusCode: 400,
                });
            }
        }
    };
}
