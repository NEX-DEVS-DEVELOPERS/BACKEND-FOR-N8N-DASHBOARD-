import { Router } from 'express';
import { authController } from '../controllers/authController';
import { adminController } from '../controllers/adminController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/admin/verify
 * @desc    Verify admin panel password
 * @access  Public
 */
router.post('/verify', async (req, res) => {
    try {
        const { password } = req.body;
        const isValid = await authController.verifyAdminPassword(password);

        if (isValid) {
            res.status(200).json({ success: true, message: 'Password verified' });
        } else {
            res.status(401).json({ success: false, error: 'Invalid password', statusCode: 401 });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error', statusCode: 500 });
    }
});

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user (requires admin password)
 * @access  Admin only
 */
router.post('/users', (req, res) => authController.createUser(req, res));

// Apply admin middleware to all routes below
router.use(requireAdmin);

/**
 * @route   GET /api/admin/dashboard-stats
 * @desc    Get dashboard overview stats
 */
router.get('/dashboard-stats', (req, res) => adminController.getDashboardStats(req, res));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with stats
 */
router.get('/users-list', (req, res) => adminController.getAllUsers(req, res));

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get user details
 */
router.get('/users/:userId', (req, res) => adminController.getUserDetails(req, res));

/**
 * @route   GET /api/admin/support-requests
 * @desc    Get all support requests
 */
router.get('/support-requests', (req, res) => adminController.getAllSupportRequests(req, res));

/**
 * @route   GET /api/admin/change-requests
 * @desc    Get all change requests
 */
router.get('/change-requests', (req, res) => adminController.getAllChangeRequests(req, res));

/**
 * @route   POST /api/admin/support-requests/:requestId/complete
 * @desc    Mark support request as complete
 */
router.post('/support-requests/:requestId/complete', (req, res) => adminController.markSupportRequestComplete(req, res));

/**
 * @route   POST /api/admin/change-requests/:requestId/complete
 * @desc    Mark change request as complete
 */
router.post('/change-requests/:requestId/complete', (req, res) => adminController.markChangeRequestComplete(req, res));

/**
 * @route   POST /api/admin/users/:userId/dashboard
 * @desc    Update user dashboard data manually
 */
router.post('/users/:userId/dashboard', (req, res) => adminController.updateUserDashboard(req, res));

export default router;
