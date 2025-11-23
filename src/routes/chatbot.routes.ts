import express, { Router, Request, Response, NextFunction } from 'express';
import {
    sendMessage,
    streamMessage,
    clearHistory,
    getContext,
    healthCheck
} from '../controllers/chatbotController';
import { authenticate } from '../middleware/auth';

const router: Router = express.Router();

/**
 * @route   POST /api/chatbot/message
 * @desc    Send message to chatbot and get response
 * @access  Private - Requires authentication
 */
router.post('/message', authenticate, sendMessage);

/**
 * @route   POST /api/chatbot/stream
 * @desc    Send message with streaming response (SSE)
 * @access  Private - Requires authentication
 */
router.post('/stream', authenticate, streamMessage);

/**
 * @route   DELETE /api/chatbot/history
 * @desc    Clear chat history for current user
 * @access  Private - Requires authentication
 */
router.delete('/history', authenticate, clearHistory);

/**
 * @route   GET /api/chatbot/context
 * @desc    Get current system context
 * @access  Private - Requires authentication
 */
router.get('/context', authenticate, getContext);

/**
 * @route   GET /api/chatbot/health
 * @desc    Check AI model availability and health
 * @access  Private - Requires authentication
 */
router.get('/health', authenticate, healthCheck);

export default router;
