import { Router } from 'express';
import { settingsController } from '../controllers/settingsController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/settings/uptime
 * @desc Get server uptime
 * @access Public
 */
router.get(
    '/uptime',
    (req, res) => settingsController.getUptime(req, res)
);

/**
 * @route GET /api/settings/preferences
 * @desc Get user notification preferences
 * @access Private
 */
router.get(
    '/preferences',
    authenticate,
    (req, res) => settingsController.getPreferences(req, res)
);

/**
 * @route PUT /api/settings/preferences
 * @desc Update user notification preferences
 * @access Private
 */
router.put(
    '/preferences',
    authenticate,
    (req, res) => settingsController.updatePreferences(req, res)
);

/**
 * @route POST /api/settings/change-password
 * @desc Change user password
 * @access Private
 */
router.post(
    '/change-password',
    authenticate,
    (req, res) => settingsController.changePassword(req, res)
);

export default router;
