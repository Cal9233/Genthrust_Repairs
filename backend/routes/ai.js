import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Rate limiting storage (in-memory - use Redis in production)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

// Rate limiting middleware
const rateLimiter = (req, res, next) => {
  const userId = req.body.userId || req.headers['x-user-id'] || 'anonymous';
  const now = Date.now();

  // Get or create user's rate limit data
  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
  }

  const userLimit = rateLimitStore.get(userId);

  // Reset if window has passed
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + RATE_LIMIT_WINDOW;
  }

  // Check if limit exceeded
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${MAX_REQUESTS_PER_WINDOW} requests per minute. Try again in ${retryAfter} seconds.`,
      retryAfter
    });
  }

  // Increment count
  userLimit.count++;

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS_PER_WINDOW - userLimit.count);
  res.setHeader('X-RateLimit-Reset', new Date(userLimit.resetTime).toISOString());

  next();
};

// Request validation middleware
const validateChatRequest = (req, res, next) => {
  const { messages, model, maxTokens, temperature, tools, systemPrompt } = req.body;

  // Validate required fields
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'messages array is required and must not be empty'
    });
  }

  // Validate message format
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Each message must have role and content properties'
      });
    }

    if (!['user', 'assistant'].includes(msg.role)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Message role must be either "user" or "assistant"'
      });
    }
  }

  // Validate model
  const validModels = [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
  ];

  if (model && !validModels.includes(model)) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Invalid model. Must be one of: ${validModels.join(', ')}`
    });
  }

  // Validate max tokens
  if (maxTokens && (maxTokens < 1 || maxTokens > 8192)) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'maxTokens must be between 1 and 8192'
    });
  }

  // Validate temperature
  if (temperature !== undefined && (temperature < 0 || temperature > 1)) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'temperature must be between 0 and 1'
    });
  }

  next();
};

// POST /api/ai/chat - Main chat endpoint with streaming
router.post('/chat', rateLimiter, validateChatRequest, async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      messages,
      model = 'claude-sonnet-4-20250514',
      maxTokens = 4096,
      temperature = 0.2,
      tools,
      systemPrompt,
      stream = false,
      userId
    } = req.body;

    console.log(`[AI Proxy] Chat request from user: ${userId || 'anonymous'}`);
    console.log(`[AI Proxy] Model: ${model}, Messages: ${messages.length}, Tools: ${tools ? tools.length : 0}`);

    // Build Anthropic API request
    const anthropicRequest = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages
    };

    if (systemPrompt) {
      anthropicRequest.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      anthropicRequest.tools = tools;
    }

    // Handle streaming response
    if (stream) {
      // Set headers for SSE (Server-Sent Events)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const stream = await anthropic.messages.create({
          ...anthropicRequest,
          stream: true
        });

        for await (const event of stream) {
          // Send each event to the client
          res.write(`data: ${JSON.stringify(event)}\n\n`);

          // Handle stream completion
          if (event.type === 'message_stop') {
            const duration = Date.now() - startTime;
            console.log(`[AI Proxy] Stream completed in ${duration}ms`);
            res.write(`data: [DONE]\n\n`);
            res.end();
          }
        }
      } catch (streamError) {
        console.error('[AI Proxy] Streaming error:', streamError);
        res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const response = await anthropic.messages.create(anthropicRequest);

      const duration = Date.now() - startTime;
      console.log(`[AI Proxy] Request completed in ${duration}ms`);
      console.log(`[AI Proxy] Usage - Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`);

      res.json({
        success: true,
        response,
        meta: {
          duration,
          model,
          usage: response.usage
        }
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[AI Proxy] Error:', error);

    // Handle Anthropic-specific errors
    if (error.status) {
      return res.status(error.status).json({
        error: 'Anthropic API error',
        message: error.message,
        type: error.type,
        duration
      });
    }

    // Handle general errors
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      duration
    });
  }
});

// POST /api/ai/health - Check if Anthropic API is accessible
router.get('/health', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        status: 'error',
        message: 'Anthropic API key not configured'
      });
    }

    res.json({
      status: 'ok',
      message: 'AI proxy is ready',
      model: 'claude-sonnet-4-20250514',
      rateLimit: {
        maxRequests: MAX_REQUESTS_PER_WINDOW,
        windowSeconds: RATE_LIMIT_WINDOW / 1000
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});

// POST /api/ai/clear-rate-limit - Clear rate limit for a user (admin only)
router.post('/clear-rate-limit', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'userId is required'
    });
  }

  if (rateLimitStore.has(userId)) {
    rateLimitStore.delete(userId);
    console.log(`[AI Proxy] Rate limit cleared for user: ${userId}`);
  }

  res.json({
    success: true,
    message: `Rate limit cleared for user: ${userId}`
  });
});

export default router;
