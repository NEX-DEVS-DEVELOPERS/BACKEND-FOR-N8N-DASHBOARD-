import { Router } from 'express';
import { authController } from '../controllers/authController';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { loginSchema } from '../types/auth.types';

const router = Router();

/**
 * @route POST /api/auth/login
 * @desc Login user and get JWT token
 * @access Public
 */
router.post(
    '/login',
    authLimiter,
    validate(loginSchema, 'body'),
    (req, res) => authController.login(req, res)
);

/**
 * @route GET /api/auth/validate
 * @desc Validate JWT token and return user data
 * @access Private
 */
router.get(
    '/validate',
    authenticate,
    (req, res) => authController.validate(req, res)
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user (client-side token removal)
 * @access Private
 */
router.post(
    '/logout',
    authenticate,
    (req, res) => authController.logout(req, res)
);

/**
 * @route PUT /api/auth/plan
 * @desc Update user plan and addon
 * @access Private
 */
router.put(
    '/plan',
    authenticate,
    (req, res) => authController.updatePlan(req, res)
);

/**
 * @route POST /api/auth/cancel-plan
 * @desc Cancel user plan (downgrade to free)
 * @access Private
 */
router.post(
    '/cancel-plan',
    authenticate,
    (req, res) => authController.cancelPlan(req, res)
);

export default router;
