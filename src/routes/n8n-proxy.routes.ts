import { Router } from 'express';
import { n8nProxyController } from '../controllers/n8nProxyController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All proxy routes require authentication
router.use(authenticate);

/**
 * @route POST /api/n8n-proxy/trigger
 * @desc Proxy webhook call to n8n (fixes CORS)
 * @access Private
 */
router.post('/trigger', (req, res) =>
    n8nProxyController.proxyWebhook(req, res)
);

/**
 * @route POST /api/n8n-proxy/test
 * @desc Test webhook connection
 * @access Private
 */
router.post('/test', (req, res) =>
    n8nProxyController.testWebhook(req, res)
);

export default router;
