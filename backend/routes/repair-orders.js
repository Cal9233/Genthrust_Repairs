import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Helper: Convert MySQL DATE to ISO string for frontend
 */
const formatDateForResponse = (date) => {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : date;
};

/**
 * Helper: Convert JS Date object or ISO string to MySQL DATE format (YYYY-MM-DD)
 */
const formatDateForMySQL = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

/**
 * Helper: Parse statusHistory JSON from request
 */
const parseStatusHistory = (history) => {
  if (!history) return null;
  if (typeof history === 'string') {
    try {
      return JSON.parse(history);
    } catch (e) {
      console.error('[RO API] Invalid statusHistory JSON:', e);
      return null;
    }
  }
  return history;
};

/**
 * Helper: Map database row to RepairOrder interface
 */
const mapRowToRepairOrder = (row) => {
  return {
    id: row.id.toString(),
    roNumber: row.roNumber,
    dateMade: formatDateForResponse(row.dateMade),
    shopName: row.shopName,
    partNumber: row.partNumber || '',
    serialNumber: row.serialNumber || '',
    partDescription: row.partDescription,
    requiredWork: row.requiredWork || '',
    dateDroppedOff: formatDateForResponse(row.dateDroppedOff),
    estimatedCost: row.estimatedCost ? parseFloat(row.estimatedCost) : null,
    finalCost: row.finalCost ? parseFloat(row.finalCost) : null,
    terms: row.terms || '',
    shopReferenceNumber: row.shopReferenceNumber || '',
    estimatedDeliveryDate: formatDateForResponse(row.estimatedDeliveryDate),
    currentStatus: row.currentStatus,
    currentStatusDate: formatDateForResponse(row.currentStatusDate),
    genThrustStatus: row.genThrustStatus || '',
    shopStatus: row.shopStatus || '',
    trackingNumber: row.trackingNumber || '',
    notes: row.notes || '',
    lastDateUpdated: formatDateForResponse(row.lastDateUpdated),
    nextDateToUpdate: formatDateForResponse(row.nextDateToUpdate),
    statusHistory: row.statusHistory ? (typeof row.statusHistory === 'string' ? JSON.parse(row.statusHistory) : row.statusHistory) : [],
    archiveStatus: row.archiveStatus,
    // Computed fields (calculated on frontend)
    daysOverdue: 0,
    isOverdue: false
  };
};

/**
 * Get all repair orders with optional archive status filter
 * GET /api/ros?archiveStatus=ACTIVE
 * GET /api/ros?archiveStatus=PAID
 * GET /api/ros (defaults to ACTIVE)
 */
router.get('/', async (req, res) => {
  try {
    const { archiveStatus = 'ACTIVE' } = req.query;

    console.log(`[RO API] Getting repair orders with archiveStatus: ${archiveStatus}`);

    // Validate archiveStatus
    const validStatuses = ['ACTIVE', 'PAID', 'NET', 'RETURNED'];
    if (!validStatuses.includes(archiveStatus)) {
      return res.status(400).json({
        error: 'Invalid archiveStatus',
        validValues: validStatuses
      });
    }

    const [rows] = await pool.query(
      `SELECT * FROM repair_orders WHERE archiveStatus = ? ORDER BY nextDateToUpdate ASC, dateMade DESC`,
      [archiveStatus]
    );

    const repairOrders = rows.map(mapRowToRepairOrder);

    console.log(`[RO API] Found ${repairOrders.length} repair orders`);
    res.json(repairOrders);
  } catch (error) {
    console.error('[RO API] Get repair orders error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get single repair order by ID
 * GET /api/ros/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[RO API] Getting repair order: ${id}`);

    const [rows] = await pool.query(
      'SELECT * FROM repair_orders WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    res.json(mapRowToRepairOrder(rows[0]));
  } catch (error) {
    console.error('[RO API] Get repair order error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Create new repair order
 * POST /api/ros
 */
router.post('/', async (req, res) => {
  try {
    const ro = req.body;

    console.log(`[RO API] Creating repair order: ${ro.roNumber}`);

    // Validate required fields
    if (!ro.roNumber || !ro.shopName || !ro.partDescription || !ro.currentStatus) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['roNumber', 'shopName', 'partDescription', 'currentStatus']
      });
    }

    // Check for duplicate roNumber
    const [existing] = await pool.query(
      'SELECT id FROM repair_orders WHERE roNumber = ?',
      [ro.roNumber]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Duplicate RO number',
        message: `RO ${ro.roNumber} already exists`
      });
    }

    // Parse statusHistory
    const statusHistory = parseStatusHistory(ro.statusHistory) || [];

    // Insert new RO
    const [result] = await pool.query(
      `INSERT INTO repair_orders (
        roNumber, dateMade, shopName, partNumber, serialNumber,
        partDescription, requiredWork, dateDroppedOff, estimatedCost, finalCost,
        terms, shopReferenceNumber, estimatedDeliveryDate, currentStatus,
        currentStatusDate, genThrustStatus, shopStatus, trackingNumber, notes,
        lastDateUpdated, nextDateToUpdate, statusHistory, archiveStatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ro.roNumber,
        formatDateForMySQL(ro.dateMade),
        ro.shopName,
        ro.partNumber || null,
        ro.serialNumber || null,
        ro.partDescription,
        ro.requiredWork || null,
        formatDateForMySQL(ro.dateDroppedOff),
        ro.estimatedCost || null,
        ro.finalCost || null,
        ro.terms || null,
        ro.shopReferenceNumber || null,
        formatDateForMySQL(ro.estimatedDeliveryDate),
        ro.currentStatus,
        formatDateForMySQL(ro.currentStatusDate || new Date()),
        ro.genThrustStatus || null,
        ro.shopStatus || null,
        ro.trackingNumber || null,
        ro.notes || null,
        formatDateForMySQL(new Date()),
        formatDateForMySQL(ro.nextDateToUpdate),
        JSON.stringify(statusHistory),
        ro.archiveStatus || 'ACTIVE'
      ]
    );

    // Fetch the created RO
    const [newRO] = await pool.query(
      'SELECT * FROM repair_orders WHERE id = ?',
      [result.insertId]
    );

    console.log(`[RO API] Created repair order ID: ${result.insertId}`);
    res.status(201).json(mapRowToRepairOrder(newRO[0]));
  } catch (error) {
    console.error('[RO API] Create repair order error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Update repair order (including archiveStatus for archiving)
 * PATCH /api/ros/:id
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`[RO API] Updating repair order: ${id}`);

    // Check if RO exists
    const [existing] = await pool.query(
      'SELECT * FROM repair_orders WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    // Build dynamic UPDATE query
    const fields = [];
    const values = [];

    // Map of allowed fields to update
    const fieldMap = {
      roNumber: 'roNumber',
      dateMade: 'dateMade',
      shopName: 'shopName',
      partNumber: 'partNumber',
      serialNumber: 'serialNumber',
      partDescription: 'partDescription',
      requiredWork: 'requiredWork',
      dateDroppedOff: 'dateDroppedOff',
      estimatedCost: 'estimatedCost',
      finalCost: 'finalCost',
      terms: 'terms',
      shopReferenceNumber: 'shopReferenceNumber',
      estimatedDeliveryDate: 'estimatedDeliveryDate',
      currentStatus: 'currentStatus',
      currentStatusDate: 'currentStatusDate',
      genThrustStatus: 'genThrustStatus',
      shopStatus: 'shopStatus',
      trackingNumber: 'trackingNumber',
      notes: 'notes',
      lastDateUpdated: 'lastDateUpdated',
      nextDateToUpdate: 'nextDateToUpdate',
      statusHistory: 'statusHistory',
      archiveStatus: 'archiveStatus'
    };

    Object.keys(updates).forEach(key => {
      if (fieldMap[key]) {
        fields.push(`${fieldMap[key]} = ?`);

        // Handle date fields
        if (key.includes('Date') || key === 'dateMade') {
          values.push(formatDateForMySQL(updates[key]));
        }
        // Handle JSON fields
        else if (key === 'statusHistory') {
          const history = parseStatusHistory(updates[key]) || [];
          values.push(JSON.stringify(history));
        }
        // Handle numeric fields
        else if (key === 'estimatedCost' || key === 'finalCost') {
          values.push(updates[key] ? parseFloat(updates[key]) : null);
        }
        // All other fields
        else {
          values.push(updates[key]);
        }
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Always update lastDateUpdated
    fields.push('lastDateUpdated = ?');
    values.push(formatDateForMySQL(new Date()));

    // Add ID to end of values array
    values.push(id);

    // Execute update
    await pool.query(
      `UPDATE repair_orders SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated RO
    const [updatedRO] = await pool.query(
      'SELECT * FROM repair_orders WHERE id = ?',
      [id]
    );

    console.log(`[RO API] Updated repair order ID: ${id}`);
    res.json(mapRowToRepairOrder(updatedRO[0]));
  } catch (error) {
    console.error('[RO API] Update repair order error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Delete repair order (permanent delete)
 * DELETE /api/ros/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[RO API] Deleting repair order: ${id}`);

    // Check if RO exists
    const [existing] = await pool.query(
      'SELECT roNumber FROM repair_orders WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    const roNumber = existing[0].roNumber;

    // Delete the RO
    await pool.query('DELETE FROM repair_orders WHERE id = ?', [id]);

    console.log(`[RO API] Deleted repair order: ${roNumber}`);
    res.json({
      success: true,
      message: `Repair order ${roNumber} deleted successfully`
    });
  } catch (error) {
    console.error('[RO API] Delete repair order error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get dashboard statistics
 * GET /api/ros/stats/dashboard
 */
router.get('/stats/dashboard', async (req, res) => {
  try {
    console.log('[RO API] Getting dashboard statistics');

    // Get counts by archiveStatus
    const [archiveCounts] = await pool.query(`
      SELECT
        archiveStatus,
        COUNT(*) as count,
        COALESCE(SUM(finalCost), 0) as totalValue,
        COALESCE(SUM(estimatedCost), 0) as totalEstimatedValue
      FROM repair_orders
      GROUP BY archiveStatus
    `);

    // Get active RO statistics
    const [activeStats] = await pool.query(`
      SELECT
        COUNT(*) as totalActive,
        COUNT(CASE WHEN nextDateToUpdate < CURDATE() THEN 1 END) as overdue,
        COUNT(CASE WHEN currentStatus = 'WAITING QUOTE' THEN 1 END) as waitingQuote,
        COUNT(CASE WHEN currentStatus LIKE 'APPROVED%' THEN 1 END) as approved,
        COUNT(CASE WHEN currentStatus = 'BEING REPAIRED' THEN 1 END) as beingRepaired,
        COUNT(CASE WHEN currentStatus IN ('SHIPPING', 'CURRENTLY BEING SHIPPED') THEN 1 END) as shipping,
        COUNT(CASE WHEN nextDateToUpdate = CURDATE() THEN 1 END) as dueToday,
        COUNT(CASE WHEN nextDateToUpdate < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as overdue30Plus,
        COALESCE(SUM(finalCost), 0) as totalValue,
        COALESCE(SUM(estimatedCost), 0) as totalEstimatedValue
      FROM repair_orders
      WHERE archiveStatus = 'ACTIVE'
    `);

    const stats = activeStats[0];
    const archiveMap = {};
    archiveCounts.forEach(row => {
      archiveMap[row.archiveStatus] = {
        count: parseInt(row.count),
        totalValue: parseFloat(row.totalValue)
      };
    });

    res.json({
      // Active RO stats
      totalActive: parseInt(stats.totalActive),
      overdue: parseInt(stats.overdue),
      waitingQuote: parseInt(stats.waitingQuote),
      approved: parseInt(stats.approved),
      beingRepaired: parseInt(stats.beingRepaired),
      shipping: parseInt(stats.shipping),
      dueToday: parseInt(stats.dueToday),
      overdue30Plus: parseInt(stats.overdue30Plus),
      onTrack: parseInt(stats.totalActive) - parseInt(stats.overdue),
      totalValue: parseFloat(stats.totalValue),
      totalEstimatedValue: parseFloat(stats.totalEstimatedValue),
      totalFinalValue: parseFloat(stats.totalValue),

      // Archive stats
      approvedPaid: archiveMap.PAID?.count || 0,
      approvedNet: archiveMap.NET?.count || 0,
      rai: 0, // TODO: Count from currentStatus if needed
      ber: 0, // TODO: Count from currentStatus if needed
      cancel: 0, // TODO: Count from currentStatus if needed
      scrapped: archiveMap.RETURNED?.count || 0
    });
  } catch (error) {
    console.error('[RO API] Dashboard stats error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

export default router;
