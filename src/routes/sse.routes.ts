import { Router } from 'express';
import { logController } from '../controllers/logController';
import { authenticate } from '../middleware/auth';

const router = Router();

// SSE route requires authentication
router.use(authenticate);

/**
 * @route GET /api/sse/stream/:sessionId
 * @desc Stream logs via Server-Sent Events
 * @access Private
 */
router.get('/stream/:sessionId', (req, res) => logController.streamLogs(req, res));

export default router;
