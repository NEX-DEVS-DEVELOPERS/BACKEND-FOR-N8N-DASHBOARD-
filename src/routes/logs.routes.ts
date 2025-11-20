import { Router } from 'express';
import { logController } from '../controllers/logController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All log routes require authentication
router.use(authenticate);

/**
 * @route GET /api/logs/sessions
 * @desc Get all log sessions for authenticated user
 * @access Private
 */
router.get('/sessions', (req, res) => logController.getAllSessions(req, res));

/**
 * @route GET /api/logs/sessions/:sessionId
 * @desc Get a specific log session with logs
 * @access Private
 */
router.get('/sessions/:sessionId', (req, res) => logController.getSession(req, res));

/**
 * @route DELETE /api/logs/sessions/:sessionId
 * @desc Delete a log session
 * @access Private
 */
router.delete('/sessions/:sessionId', (req, res) => logController.deleteSession(req, res));

export default router;
