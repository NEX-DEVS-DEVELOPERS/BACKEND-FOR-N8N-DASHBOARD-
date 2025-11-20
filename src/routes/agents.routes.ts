import { Router } from 'express';
import { agentController } from '../controllers/agentController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createAgentSchema, updateAgentSchema } from '../types/agent.types';
import { webhookLimiter } from '../middleware/rateLimiter';

const router = Router();

// All agent routes require authentication
router.use(authenticate);

/**
 * @route GET /api/agents
 * @desc Get all agents for authenticated user
 * @access Private
 */
router.get('/', (req, res) => agentController.getAll(req, res));

/**
 * @route GET /api/agents/:id
 * @desc Get a single agent by ID
 * @access Private
 */
router.get('/:id', (req, res) => agentController.getOne(req, res));

/**
 * @route POST /api/agents
 * @desc Create a new agent
 * @access Private
 */
router.post(
    '/',
    validate(createAgentSchema, 'body'),
    (req, res) => agentController.create(req, res)
);

/**
 * @route PUT /api/agents/:id
 * @desc Update an agent
 * @access Private
 */
router.put(
    '/:id',
    validate(updateAgentSchema, 'body'),
    (req, res) => agentController.update(req, res)
);

/**
 * @route DELETE /api/agents/:id
 * @desc Delete an agent
 * @access Private
 */
router.delete('/:id', (req, res) => agentController.delete(req, res));

/**
 * @route POST /api/agents/:id/trigger
 * @desc Trigger an agent manually
 * @access Private
 */
router.post(
    '/:id/trigger',
    webhookLimiter,
    (req, res) => agentController.trigger(req, res)
);

/**
 * @route POST /api/agents/:id/stop
 * @desc Stop a running agent
 * @access Private
 */
router.post('/:id/stop', (req, res) => agentController.stop(req, res));

export default router;
