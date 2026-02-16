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

// GET /api/chat/sessions - Get user's chat sessions (with actual messages only)
router.get('/sessions', authenticate, (req, res) => chatbotController.getSessions(req, res));

// GET /api/chat/sessions/:sessionId - Load a specific session's messages
router.get('/sessions/:sessionId', authenticate, (req, res) => chatbotController.loadSession(req, res));

// DELETE /api/chat/sessions/:sessionId - Delete a session
router.delete('/sessions/:sessionId', authenticate, (req, res) => chatbotController.deleteSession(req, res));

// POST /api/chat/sessions - Create a new session
router.post('/sessions', authenticate, (req, res) => chatbotController.createSession(req, res));

export const chatbotRoutes = router;
