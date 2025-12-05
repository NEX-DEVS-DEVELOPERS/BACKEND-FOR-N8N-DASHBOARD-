import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/overview - Get complete dashboard overview
router.get('/overview', authenticate, (req, res) => dashboardController.getOverview(req, res));

// GET /api/dashboard/dev-credits - Get dev credit history
router.get('/dev-credits', authenticate, (req, res) => dashboardController.getDevCredits(req, res));

// GET /api/dashboard/changelog - Get public changelog entries
router.get('/changelog', (req, res) => dashboardController.getChangelog(req, res));

// GET /api/dashboard/activity - Get user activity log
router.get('/activity', authenticate, (req, res) => dashboardController.getActivity(req, res));

export default router;
