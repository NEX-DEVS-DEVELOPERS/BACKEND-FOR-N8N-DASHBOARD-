import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/overview - Get complete dashboard overview
router.get('/overview', authenticate, (req, res) => dashboardController.getOverview(req, res));

// GET /api/dashboard/dev-credits - Get dev credit history
router.get('/dev-credits', authenticate, (req, res) => dashboardController.getDevCredits(req, res));

// POST /api/dashboard/dev-credits - Create a dev credit log
router.post('/dev-credits', authenticate, (req, res) => dashboardController.createDevCreditLog(req, res));

// GET /api/dashboard/changelog - Get public changelog entries
router.get('/changelog', (req, res) => dashboardController.getChangelog(req, res));

// GET /api/dashboard/activity - Get user activity log
router.get('/activity', authenticate, (req, res) => dashboardController.getActivity(req, res));

// GET /api/dashboard/invoices - Get user invoices
router.get('/invoices', authenticate, (req, res) => dashboardController.getInvoices(req, res));

// GET /api/dashboard/requests - Get active requests
router.get('/requests', authenticate, (req, res) => dashboardController.getActiveRequests(req, res));

export default router;
