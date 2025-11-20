import { Router } from 'express';
import { statsController } from '../controllers/statsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All stats routes require authentication
router.use(authenticate);

/**
 * @route GET /api/stats/dashboard
 * @desc Get dashboard statistics
 * @access Private
 */
router.get('/dashboard', (req, res) => statsController.getDashboardStats(req, res));

/**
 * @route GET /api/stats/support-usage
 * @desc Get support usage statistics
 * @access Private
 */
router.get('/support-usage', (req, res) => statsController.getSupportUsage(req, res));

export default router;
