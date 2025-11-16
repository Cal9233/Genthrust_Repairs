import express from 'express';
import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Save AI conversation log
 * POST /api/ai-logs
 */
router.post('/', async (req, res) => {
  try {
    const {
      conversationId,
      user,
      userMessage,
      aiResponse,
      success = true,
      error = null,
      model = 'claude-sonnet-4',
      durationMs = null,
      contextRoCount = null
    } = req.body;

    if (!user || !userMessage) {
      return res.status(400).json({ error: 'User and userMessage are required' });
    }

    const query = `
      INSERT INTO ai_conversation_logs
      (conversation_id, user, user_message, ai_response, success, error, model, duration_ms, context_ro_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      conversationId || uuidv4(),
      user,
      userMessage,
      aiResponse || null,
      success,
      error,
      model,
      durationMs,
      contextRoCount
    ];

    const [result] = await db.execute(query, values);

    res.json({
      success: true,
      id: result.insertId,
      message: 'Log saved successfully'
    });

  } catch (error) {
    console.error('[AI Logs API] Error saving log:', error);
    res.status(500).json({ error: 'Failed to save log', details: error.message });
  }
});

/**
 * Get AI conversation logs
 * GET /api/ai-logs?limit=50&offset=0&user=xxx&conversationId=xxx
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      user = null,
      conversationId = null,
      startDate = null,
      endDate = null
    } = req.query;

    let query = `
      SELECT
        id,
        conversation_id as conversationId,
        timestamp,
        user,
        user_message as userMessage,
        ai_response as aiResponse,
        success,
        error,
        model,
        duration_ms as durationMs,
        context_ro_count as contextRoCount
      FROM ai_conversation_logs
      WHERE 1=1
    `;

    const values = [];

    if (user) {
      query += ' AND user = ?';
      values.push(user);
    }

    if (conversationId) {
      query += ' AND conversation_id = ?';
      values.push(conversationId);
    }

    if (startDate) {
      query += ' AND timestamp >= ?';
      values.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      values.push(endDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    values.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.execute(query, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM ai_conversation_logs WHERE 1=1';
    const countValues = [];

    if (user) {
      countQuery += ' AND user = ?';
      countValues.push(user);
    }

    if (conversationId) {
      countQuery += ' AND conversation_id = ?';
      countValues.push(conversationId);
    }

    if (startDate) {
      countQuery += ' AND timestamp >= ?';
      countValues.push(startDate);
    }

    if (endDate) {
      countQuery += ' AND timestamp <= ?';
      countValues.push(endDate);
    }

    const [countResult] = await db.execute(countQuery, countValues);
    const total = countResult[0].total;

    res.json({
      logs: rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('[AI Logs API] Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
  }
});

/**
 * Get AI logs by conversation ID
 * GET /api/ai-logs/conversation/:conversationId
 */
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const query = `
      SELECT
        id,
        conversation_id as conversationId,
        timestamp,
        user,
        user_message as userMessage,
        ai_response as aiResponse,
        success,
        error,
        model,
        duration_ms as durationMs,
        context_ro_count as contextRoCount
      FROM ai_conversation_logs
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `;

    const [rows] = await db.execute(query, [conversationId]);

    res.json({ logs: rows });

  } catch (error) {
    console.error('[AI Logs API] Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation', details: error.message });
  }
});

/**
 * Delete AI log by ID
 * DELETE /api/ai-logs/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM ai_conversation_logs WHERE id = ?';
    const [result] = await db.execute(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json({ success: true, message: 'Log deleted successfully' });

  } catch (error) {
    console.error('[AI Logs API] Error deleting log:', error);
    res.status(500).json({ error: 'Failed to delete log', details: error.message });
  }
});

/**
 * Delete all logs for a user
 * DELETE /api/ai-logs/user/:user
 */
router.delete('/user/:user', async (req, res) => {
  try {
    const { user } = req.params;

    const query = 'DELETE FROM ai_conversation_logs WHERE user = ?';
    const [result] = await db.execute(query, [user]);

    res.json({
      success: true,
      deleted: result.affectedRows,
      message: `Deleted ${result.affectedRows} logs for user ${user}`
    });

  } catch (error) {
    console.error('[AI Logs API] Error deleting user logs:', error);
    res.status(500).json({ error: 'Failed to delete user logs', details: error.message });
  }
});

/**
 * Get AI logs statistics
 * GET /api/ai-logs/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as totalLogs,
        COUNT(DISTINCT user) as totalUsers,
        COUNT(DISTINCT conversation_id) as totalConversations,
        AVG(duration_ms) as avgDurationMs,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errorCount
      FROM ai_conversation_logs
    `;

    const [stats] = await db.execute(statsQuery);

    res.json(stats[0]);

  } catch (error) {
    console.error('[AI Logs API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

export default router;
