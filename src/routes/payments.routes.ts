
import { Router } from 'express';
import { paymentController } from '../controllers/paymentController';
import { webhookController } from '../controllers/webhookController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/payments/checkout
 * @desc Create a checkout session
 * @access Private
 */
router.post('/checkout', authenticate, (req, res) => paymentController.createCheckout(req, res));

/**
 * @route GET /api/payments/products
 * @desc Get Polar products
 * @access Private
 */
router.get('/products', authenticate, (req, res) => paymentController.getProducts(req, res));

/**
 * @route POST /api/payments/webhook
 * @desc Polar webhook endpoint
 * @access Public
 */
router.post('/webhook', (req, res) => webhookController.handlePolarWebhook(req, res));

export default router;
