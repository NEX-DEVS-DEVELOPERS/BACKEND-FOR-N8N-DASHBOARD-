import { Router } from 'express';
import { n8nLogsController } from '../controllers/n8nLogsController';
import { authenticate } from '../middleware/auth';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = Router();

/**
 * @route GET /api/n8n-logs/:runId
 * @desc Get logs by run ID
 * @access Private (requires authentication)
 */
router.get('/:runId', authenticate, (req, res) =>
    n8nLogsController.getLogsByRunId(req as any, res)
);

/**
 * @route POST /api/n8n-logs
 * @desc Create a new log entry (called by n8n)
 * @access API Key Auth (no user auth required)
 */
router.post('/', apiKeyAuth, (req, res) =>
    n8nLogsController.createLog(req as any, res)
);

/**
 * @route PATCH /api/n8n-logs/:runId/status
 * @desc Update log status
 * @access API Key Auth (no user auth required)
 */
router.patch('/:runId/status', apiKeyAuth, (req, res) =>
    n8nLogsController.updateLogStatus(req as any, res)
);

/**
 * @route DELETE /api/n8n-logs/cleanup/:days
 * @desc Clean up old logs
 * @access Private (admin only)
 */
router.delete('/cleanup/:days', authenticate, (req, res) =>
    n8nLogsController.cleanupOldLogs(req as any, res)
);

export default router;
