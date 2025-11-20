import { Router } from 'express';
import { authController } from '../controllers/authController';

const router = Router();

/**
 * @route   POST /api/admin/verify
 * @desc    Verify admin panel password
 * @access  Public
 */
router.post('/verify', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            res.status(400).json({
                success: false,
                error: 'Password is required',
                statusCode: 400,
            });
            return;
        }

        const isValid = await authController.verifyAdminPassword(password);

        if (isValid) {
            res.status(200).json({
                success: true,
                message: 'Password verified',
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid password',
                statusCode: 401,
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            statusCode: 500,
        });
    }
});

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user (requires admin password)
 * @access  Admin only
 */
router.post('/users', (req, res) => authController.createUser(req, res));

export default router;
