import { Router } from 'express';
import { chatbotController } from '../controllers/chatbotController';
import { authenticate } from '../middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for chat (adjust based on plan if needed, but global limit for now)
const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many chat requests from this IP, please try again later.'
});

// GET /api/chat/config - Get Welcome Message & Config
router.get('/config', authenticate, (req, res) => chatbotController.getConfig(req, res));

// POST /api/chat - Chat with Zappy
router.post('/', authenticate, chatLimiter, (req, res) => chatbotController.chat(req, res));

export const chatbotRoutes = router;
