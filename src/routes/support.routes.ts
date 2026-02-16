import { Router } from 'express';
import { supportController } from '../controllers/supportController';
import { formLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting for form submissions to prevent spam
router.post('/request', formLimiter, supportController.submitRequest);

export default router;
