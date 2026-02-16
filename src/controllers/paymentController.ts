
import { Request, Response } from 'express';
import { Polar } from '@polar-sh/sdk';
import { logger } from '../utils/logger';
import { ApiErrorResponse, ApiSuccessResponse } from '../types/api.types';

const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN || '',
});

export class PaymentController {
    /**
     * Create a checkout session for a product
     */
    async createCheckout(
        req: Request<{}, {}, { productId: string }>,
        res: Response<ApiSuccessResponse<{ url: string }> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const { productId } = req.body;
            const userId = req.user?.userId;

            if (!productId) {
                res.status(400).json({
                    success: false,
                    error: 'Product ID is required',
                    statusCode: 400,
                });
                return;
            }

            logger.info('Creating Polar checkout:', { productId, userId });

            const checkout = await polar.checkouts.create({
                products: [productId],
                successUrl: process.env.POLAR_SUCCESS_URL || '',
                externalCustomerId: userId, // Link this checkout to our user ID
                metadata: {
                    userId: userId || '',
                }
            });

            res.status(200).json({
                success: true,
                data: {
                    url: checkout.url
                }
            });
        } catch (error) {
            logger.error('Polar Checkout error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create checkout session',
                statusCode: 500,
            });
        }
    }

    /**
     * Get products from Polar
     */
    async getProducts(
        _req: Request,
        res: Response<ApiSuccessResponse<any> | ApiErrorResponse>
    ): Promise<void> {
        try {
            const products = await polar.products.list({
                organizationId: process.env.POLAR_ORGANIZATION_ID,
            });

            res.status(200).json({
                success: true,
                data: products.result.items
            });
        } catch (error) {
            logger.error('Polar Get Products error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch products',
                statusCode: 500,
            });
        }
    }
}

export const paymentController = new PaymentController();
