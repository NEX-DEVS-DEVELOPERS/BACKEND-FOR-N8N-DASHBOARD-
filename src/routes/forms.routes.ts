import { Router } from 'express';
import { formController } from '../controllers/formController';
import { authenticate } from '../middleware/auth';
import { formLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route POST /api/forms/support
 * @desc Submit support form
 * @access Private (with rate limiting)
 */
router.post(
    '/support',
    authenticate,
    formLimiter,
    (req, res) => formController.submitSupport(req, res)
);

/**
 * @route POST /api/forms/contact
 * @desc Submit contact form
 * @access Public
 */
router.post('/contact', (req, res) => formController.submitContact(req, res));

/**
 * @route POST /api/forms/request-change
 * @desc Submit request change form
 * @access Private
 */
router.post(
    '/request-change',
    authenticate,
    (req, res) => formController.submitRequestChange(req, res)
);

export default router;
