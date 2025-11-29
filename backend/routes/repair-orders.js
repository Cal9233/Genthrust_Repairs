import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * MULTI-TABLE ARCHITECTURE WITH COLUMN MAPPING
 *
 * Aiven database structure: Separate tables for each archive status
 * - active → archiveStatus='ACTIVE'
 * - paid → archiveStatus='PAID'
 * - net → archiveStatus='NET'
 * - returns → archiveStatus='RETURNED'
 *
 * Column mapping: Excel-style columns (RO, DATE_MADE) → camelCase (roNumber, dateMade)
 */

// Map archiveStatus to table name
const ARCHIVE_TABLE_MAP = {
  'ACTIVE': 'active',
  'PAID': 'paid',
  'NET': 'net',
  'RETURNED': 'returns'
};

/**
 * Build SELECT query with column aliases to map Excel columns to camelCase
 */
const buildSelectQuery = (tableName) => {
  return `
    SELECT
      id,
      RO as roNumber,
      DATE_MADE as dateMade,
      SHOP_NAME as shopName,
      PART as partNumber,
      SERIAL as serialNumber,
      PART_DESCRIPTION as partDescription,
      REQ_WORK as requiredWork,
      DATE_DROPPED_OFF as dateDroppedOff,
      ESTIMATED_COST as estimatedCost,
      FINAL_COST as finalCost,
      TERMS as terms,
      SHOP_REF as shopReferenceNumber,
      ESTIMATED_DELIVERY_DATE as estimatedDeliveryDate,
      CURENT_STATUS as currentStatus,
      CURENT_STATUS_DATE as currentStatusDate,
      GENTHRUST_STATUS as genThrustStatus,
      SHOP_STATUS as shopStatus,
      TRACKING_NUMBER_PICKING_UP as trackingNumber,
      NOTES as notes,
      LAST_DATE_UPDATED as lastDateUpdated,
      NEXT_DATE_TO_UPDATE as nextDateToUpdate
    FROM ${tableName}
  `;
};

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
 * Helper: Map database row to RepairOrder interface
 */
const mapRowToRepairOrder = (row, archiveStatus) => {
  return {
    id: row.id.toString(),
    roNumber: row.roNumber ? row.roNumber.toString() : '',
    dateMade: formatDateForResponse(row.dateMade),
    shopName: row.shopName || '',
    partNumber: row.partNumber || '',
    serialNumber: row.serialNumber || '',
    partDescription: row.partDescription || '',
    requiredWork: row.requiredWork || '',
    dateDroppedOff: formatDateForResponse(row.dateDroppedOff),
    estimatedCost: row.estimatedCost ? parseFloat(row.estimatedCost) : null,
    finalCost: row.finalCost ? parseFloat(row.finalCost) : null,
    terms: row.terms || '',
    shopReferenceNumber: row.shopReferenceNumber || '',
    estimatedDeliveryDate: formatDateForResponse(row.estimatedDeliveryDate),
    currentStatus: row.currentStatus || '',
    currentStatusDate: formatDateForResponse(row.currentStatusDate),
    genThrustStatus: row.genThrustStatus || '',
    shopStatus: row.shopStatus || '',
    trackingNumber: row.trackingNumber || '',
    notes: row.notes || '',
    lastDateUpdated: formatDateForResponse(row.lastDateUpdated),
    nextDateToUpdate: formatDateForResponse(row.nextDateToUpdate),
    statusHistory: [], // Not stored in Excel tables
    archiveStatus: archiveStatus,
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

    // Get table name for this archive status
    const tableName = ARCHIVE_TABLE_MAP[archiveStatus];

    // Build query with column mapping
    const query = buildSelectQuery(tableName) + ` ORDER BY nextDateToUpdate ASC, dateMade DESC`;

    const [rows] = await pool.query(query);

    const repairOrders = rows.map(row => mapRowToRepairOrder(row, archiveStatus));

    console.log(`[RO API] Found ${repairOrders.length} repair orders in ${tableName} table`);
    res.json(repairOrders);
  } catch (error) {
    console.error('[RO API] Get repair orders error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get dashboard statistics
 * GET /api/ros/stats/dashboard
 *
 * IMPORTANT: This route MUST be defined BEFORE /:id route
 * Otherwise Express will treat "stats" as an :id parameter
 */
router.get('/stats/dashboard', async (req, res) => {
  try {
    console.log('[RO API] Getting dashboard statistics');

    // Initialize stats
    let stats = {
      totalActive: 0,
      overdue: 0,
      waitingQuote: 0,
      approved: 0,
      beingRepaired: 0,
      shipping: 0,
      dueToday: 0,
      overdue30Plus: 0,
      onTrack: 0,
      totalValue: 0,
      totalEstimatedValue: 0,
      totalFinalValue: 0,
      approvedPaid: 0,
      approvedNet: 0,
      scrapped: 0,
      rai: 0,
      ber: 0,
      cancel: 0
    };

    // Get active RO statistics
    const [activeRows] = await pool.query(`
      SELECT
        COUNT(*) as totalActive,
        COUNT(CASE WHEN NEXT_DATE_TO_UPDATE < CURDATE() THEN 1 END) as overdue,
        COUNT(CASE WHEN CURENT_STATUS = 'WAITING QUOTE' THEN 1 END) as waitingQuote,
        COUNT(CASE WHEN CURENT_STATUS LIKE 'APPROVED%' THEN 1 END) as approved,
        COUNT(CASE WHEN CURENT_STATUS = 'BEING REPAIRED' THEN 1 END) as beingRepaired,
        COUNT(CASE WHEN CURENT_STATUS IN ('SHIPPING', 'CURRENTLY BEING SHIPPED') THEN 1 END) as shipping,
        COUNT(CASE WHEN NEXT_DATE_TO_UPDATE = CURDATE() THEN 1 END) as dueToday,
        COUNT(CASE WHEN NEXT_DATE_TO_UPDATE < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as overdue30Plus,
        COALESCE(SUM(FINAL_COST), 0) as totalValue,
        COALESCE(SUM(ESTIMATED_COST), 0) as totalEstimatedValue
      FROM active
    `);

    if (activeRows.length > 0) {
      const row = activeRows[0];
      stats.totalActive = parseInt(row.totalActive) || 0;
      stats.overdue = parseInt(row.overdue) || 0;
      stats.waitingQuote = parseInt(row.waitingQuote) || 0;
      stats.approved = parseInt(row.approved) || 0;
      stats.beingRepaired = parseInt(row.beingRepaired) || 0;
      stats.shipping = parseInt(row.shipping) || 0;
      stats.dueToday = parseInt(row.dueToday) || 0;
      stats.overdue30Plus = parseInt(row.overdue30Plus) || 0;
      stats.totalValue = parseFloat(row.totalValue) || 0;
      stats.totalEstimatedValue = parseFloat(row.totalEstimatedValue) || 0;
      stats.totalFinalValue = parseFloat(row.totalValue) || 0;
      stats.onTrack = stats.totalActive - stats.overdue;
    }

    // Get archive counts
    const [paidCount] = await pool.query('SELECT COUNT(*) as count FROM paid');
    stats.approvedPaid = parseInt(paidCount[0].count) || 0;

    const [netCount] = await pool.query('SELECT COUNT(*) as count FROM net');
    stats.approvedNet = parseInt(netCount[0].count) || 0;

    const [returnsCount] = await pool.query('SELECT COUNT(*) as count FROM returns');
    stats.scrapped = parseInt(returnsCount[0].count) || 0;

    console.log('[RO API] Dashboard stats calculated', stats);
    res.json(stats);
  } catch (error) {
    console.error('[RO API] Dashboard stats error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get single repair order by ID (searches all tables)
 * GET /api/ros/:id
 *
 * NOTE: This route uses a wildcard :id parameter, so it must come
 * AFTER any specific routes like /stats/dashboard
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[RO API] Getting repair order: ${id}`);

    // Search all tables for the RO
    for (const [archiveStatus, tableName] of Object.entries(ARCHIVE_TABLE_MAP)) {
      const query = buildSelectQuery(tableName) + ` WHERE id = ?`;
      const [rows] = await pool.query(query, [id]);

      if (rows.length > 0) {
        console.log(`[RO API] Found repair order in ${tableName} table`);
        return res.json(mapRowToRepairOrder(rows[0], archiveStatus));
      }
    }

    // Not found in any table
    return res.status(404).json({ error: 'Repair order not found' });
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

    // Determine which table to insert into
    const archiveStatus = ro.archiveStatus || 'ACTIVE';
    const tableName = ARCHIVE_TABLE_MAP[archiveStatus];

    if (!tableName) {
      return res.status(400).json({
        error: 'Invalid archiveStatus',
        validValues: Object.keys(ARCHIVE_TABLE_MAP)
      });
    }

    // Check for duplicate roNumber across all tables
    for (const table of Object.values(ARCHIVE_TABLE_MAP)) {
      const [existing] = await pool.query(
        `SELECT id FROM ${table} WHERE RO = ?`,
        [ro.roNumber]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          error: 'Duplicate RO number',
          message: `RO ${ro.roNumber} already exists`
        });
      }
    }

    // Insert new RO using Excel column names
    const [result] = await pool.query(
      `INSERT INTO ${tableName} (
        RO, DATE_MADE, SHOP_NAME, PART, SERIAL,
        PART_DESCRIPTION, REQ_WORK, DATE_DROPPED_OFF, ESTIMATED_COST, FINAL_COST,
        TERMS, SHOP_REF, ESTIMATED_DELIVERY_DATE, CURENT_STATUS,
        CURENT_STATUS_DATE, GENTHRUST_STATUS, SHOP_STATUS, TRACKING_NUMBER_PICKING_UP, NOTES,
        LAST_DATE_UPDATED, NEXT_DATE_TO_UPDATE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        formatDateForMySQL(ro.nextDateToUpdate)
      ]
    );

    // Fetch the created RO
    const query = buildSelectQuery(tableName) + ` WHERE id = ?`;
    const [newRO] = await pool.query(query, [result.insertId]);

    console.log(`[RO API] Created repair order ID: ${result.insertId} in ${tableName} table`);
    res.status(201).json(mapRowToRepairOrder(newRO[0], archiveStatus));
  } catch (error) {
    console.error('[RO API] Create repair order error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Update repair order (including archiveStatus for archiving)
 * PATCH /api/ros/:id
 *
 * NOTE: Changing archiveStatus moves the row to a different table
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`[RO API] Updating repair order: ${id}`);

    // Find which table the RO is currently in
    let currentTable = null;
    let currentArchiveStatus = null;
    let currentRow = null;

    for (const [archiveStatus, tableName] of Object.entries(ARCHIVE_TABLE_MAP)) {
      const query = buildSelectQuery(tableName) + ` WHERE id = ?`;
      const [rows] = await pool.query(query, [id]);

      if (rows.length > 0) {
        currentTable = tableName;
        currentArchiveStatus = archiveStatus;
        currentRow = rows[0];
        break;
      }
    }

    if (!currentTable) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    // Check if archiveStatus is changing
    const newArchiveStatus = updates.archiveStatus || currentArchiveStatus;
    const newTable = ARCHIVE_TABLE_MAP[newArchiveStatus];

    if (newTable !== currentTable) {
      // ARCHIVE OPERATION: Move row to different table
      console.log(`[RO API] Moving RO from ${currentTable} to ${newTable}`);

      // Start transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Merge current data with updates
        const mergedData = {
          ...currentRow,
          ...updates
        };

        // Insert into new table
        await connection.query(
          `INSERT INTO ${newTable} (
            RO, DATE_MADE, SHOP_NAME, PART, SERIAL,
            PART_DESCRIPTION, REQ_WORK, DATE_DROPPED_OFF, ESTIMATED_COST, FINAL_COST,
            TERMS, SHOP_REF, ESTIMATED_DELIVERY_DATE, CURENT_STATUS,
            CURENT_STATUS_DATE, GENTHRUST_STATUS, SHOP_STATUS, TRACKING_NUMBER_PICKING_UP, NOTES,
            LAST_DATE_UPDATED, NEXT_DATE_TO_UPDATE
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mergedData.roNumber,
            formatDateForMySQL(mergedData.dateMade),
            mergedData.shopName,
            mergedData.partNumber || null,
            mergedData.serialNumber || null,
            mergedData.partDescription,
            mergedData.requiredWork || null,
            formatDateForMySQL(mergedData.dateDroppedOff),
            mergedData.estimatedCost || null,
            mergedData.finalCost || null,
            mergedData.terms || null,
            mergedData.shopReferenceNumber || null,
            formatDateForMySQL(mergedData.estimatedDeliveryDate),
            updates.currentStatus || mergedData.currentStatus,
            formatDateForMySQL(updates.currentStatusDate || mergedData.currentStatusDate),
            updates.genThrustStatus || mergedData.genThrustStatus || null,
            updates.shopStatus || mergedData.shopStatus || null,
            updates.trackingNumber || mergedData.trackingNumber || null,
            updates.notes || mergedData.notes || null,
            formatDateForMySQL(new Date()),
            formatDateForMySQL(updates.nextDateToUpdate || mergedData.nextDateToUpdate)
          ]
        );

        // Delete from old table
        await connection.query(`DELETE FROM ${currentTable} WHERE id = ?`, [id]);

        await connection.commit();
        connection.release();

        // Fetch the moved RO
        const query = buildSelectQuery(newTable) + ` WHERE RO = ?`;
        const [movedRO] = await pool.query(query, [mergedData.roNumber]);

        console.log(`[RO API] Successfully moved RO ${id} from ${currentTable} to ${newTable}`);
        res.json(mapRowToRepairOrder(movedRO[0], newArchiveStatus));
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } else {
      // REGULAR UPDATE: Same table
      const fields = [];
      const values = [];

      // Map camelCase field names to Excel column names
      const fieldMap = {
        roNumber: 'RO',
        dateMade: 'DATE_MADE',
        shopName: 'SHOP_NAME',
        partNumber: 'PART',
        serialNumber: 'SERIAL',
        partDescription: 'PART_DESCRIPTION',
        requiredWork: 'REQ_WORK',
        dateDroppedOff: 'DATE_DROPPED_OFF',
        estimatedCost: 'ESTIMATED_COST',
        finalCost: 'FINAL_COST',
        terms: 'TERMS',
        shopReferenceNumber: 'SHOP_REF',
        estimatedDeliveryDate: 'ESTIMATED_DELIVERY_DATE',
        currentStatus: 'CURENT_STATUS',
        currentStatusDate: 'CURENT_STATUS_DATE',
        genThrustStatus: 'GENTHRUST_STATUS',
        shopStatus: 'SHOP_STATUS',
        trackingNumber: 'TRACKING_NUMBER_PICKING_UP',
        notes: 'NOTES',
        lastDateUpdated: 'LAST_DATE_UPDATED',
        nextDateToUpdate: 'NEXT_DATE_TO_UPDATE'
      };

      Object.keys(updates).forEach(key => {
        if (fieldMap[key] && key !== 'archiveStatus') {
          fields.push(`${fieldMap[key]} = ?`);

          // Handle date fields
          if (key.includes('Date') || key === 'dateMade') {
            values.push(formatDateForMySQL(updates[key]));
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
      fields.push('LAST_DATE_UPDATED = ?');
      values.push(formatDateForMySQL(new Date()));

      // Add ID to end of values array
      values.push(id);

      // Execute update
      await pool.query(
        `UPDATE ${currentTable} SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      // Fetch updated RO
      const query = buildSelectQuery(currentTable) + ` WHERE id = ?`;
      const [updatedRO] = await pool.query(query, [id]);

      console.log(`[RO API] Updated repair order ID: ${id} in ${currentTable} table`);
      res.json(mapRowToRepairOrder(updatedRO[0], currentArchiveStatus));
    }
  } catch (error) {
    console.error('[RO API] Update repair order error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Delete repair order by RO number (universal identifier)
 * DELETE /api/ros/by-number/:roNumber
 *
 * NOTE: This route MUST be defined BEFORE the /:id route
 * Otherwise Express will treat "by-number" as an :id parameter
 */
router.delete('/by-number/:roNumber', async (req, res) => {
  try {
    const { roNumber } = req.params;

    console.log(`[RO API] Deleting repair order by RO number: ${roNumber}`);

    // Search all tables for the RO by roNumber
    for (const [archiveStatus, tableName] of Object.entries(ARCHIVE_TABLE_MAP)) {
      const [existing] = await pool.query(
        `SELECT id FROM ${tableName} WHERE RO = ?`,
        [roNumber]
      );

      if (existing.length > 0) {
        // Delete the RO
        await pool.query(`DELETE FROM ${tableName} WHERE RO = ?`, [roNumber]);

        console.log(`[RO API] Deleted repair order: ${roNumber} from ${tableName} table`);
        return res.json({
          success: true,
          message: `Repair order ${roNumber} deleted successfully from ${archiveStatus}`
        });
      }
    }

    return res.status(404).json({
      error: 'Repair order not found',
      message: `No repair order found with RO number: ${roNumber}`
    });
  } catch (error) {
    console.error('[RO API] Delete repair order by number error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Delete repair order (permanent delete)
 * DELETE /api/ros/:id
 *
 * @deprecated Use DELETE /api/ros/by-number/:roNumber instead
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[RO API] Deleting repair order: ${id}`);

    // Find which table the RO is in
    for (const tableName of Object.values(ARCHIVE_TABLE_MAP)) {
      const [existing] = await pool.query(
        `SELECT RO as roNumber FROM ${tableName} WHERE id = ?`,
        [id]
      );

      if (existing.length > 0) {
        const roNumber = existing[0].roNumber;

        // Delete the RO
        await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);

        console.log(`[RO API] Deleted repair order: ${roNumber} from ${tableName}`);
        return res.json({
          success: true,
          message: `Repair order ${roNumber} deleted successfully`
        });
      }
    }

    return res.status(404).json({ error: 'Repair order not found' });
  } catch (error) {
    console.error('[RO API] Delete repair order error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

export default router;
