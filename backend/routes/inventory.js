import express from 'express';
import { inventoryPool as db } from '../config/database.js';

const router = express.Router();

/**
 * Search inventory by part number
 * GET /api/inventory/search?partNumber=xxx
 */
router.get('/search', async (req, res) => {
  try {
    const { partNumber } = req.query;

    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    console.log(`[Inventory API] Searching for part: ${partNumber}`);

    // Normalize part number (uppercase, trim spaces)
    const normalizedPN = partNumber.toUpperCase().trim();

    let rows = [];

    // Step 1: Try exact match in inventoryindex
    console.log('[Inventory API] Step 1: Exact match search');
    [rows] = await db.query(
      `SELECT
        IndexId as indexId,
        PartNumber as partNumber,
        TableName as tableName,
        RowId as rowId,
        SerialNumber as serialNumber,
        Qty as qty,
        \`Condition\` as \`condition\`,
        Location as location,
        Description as description,
        LastSeen as lastSeen
      FROM inventoryindex
      WHERE UPPER(TRIM(PartNumber)) = ?`,
      [normalizedPN]
    );

    // Step 2: If not found, try LIKE search (partial match)
    if (rows.length === 0) {
      console.log('[Inventory API] Step 2: LIKE search (partial match)');
      [rows] = await db.query(
        `SELECT
          IndexId as indexId,
          PartNumber as partNumber,
          TableName as tableName,
          RowId as rowId,
          SerialNumber as serialNumber,
          Qty as qty,
          \`Condition\` as \`condition\`,
          Location as location,
          Description as description,
          LastSeen as lastSeen
        FROM inventoryindex
        WHERE UPPER(TRIM(PartNumber)) LIKE ?
        LIMIT 50`,
        [`%${normalizedPN}%`]
      );
    }

    // Step 3: If still not found, search directly in inventory tables
    if (rows.length === 0) {
      console.log('[Inventory API] Step 3: Direct search in inventory tables');

      // Search in stock_room
      const [stockRoomRows] = await db.query(
        `SELECT
          NULL as indexId,
          PN as partNumber,
          'stock_room' as tableName,
          NULL as rowId,
          SERIAL as serialNumber,
          QTY as qty,
          COND as \`condition\`,
          LOCATION as location,
          DESCRIPTION as description,
          TAG_DATE as lastSeen
        FROM stock_room
        WHERE UPPER(TRIM(PN)) = ? OR UPPER(TRIM(PN)) LIKE ?
        LIMIT 25`,
        [normalizedPN, `%${normalizedPN}%`]
      );

      // Search in bins_inventory
      const [binsRows] = await db.query(
        `SELECT
          NULL as indexId,
          PN as partNumber,
          'bins_inventory' as tableName,
          NULL as rowId,
          SERIAL as serialNumber,
          QTY as qty,
          \`CONDITION\` as \`condition\`,
          LOCATION as location,
          DESCRIPTION as description,
          NULL as lastSeen
        FROM bins_inventory
        WHERE UPPER(TRIM(PN)) = ? OR UPPER(TRIM(PN)) LIKE ?
        LIMIT 25`,
        [normalizedPN, `%${normalizedPN}%`]
      );

      rows = [...stockRoomRows, ...binsRows];
    }

    console.log(`[Inventory API] Found ${rows.length} total matches`);
    res.json(rows);
  } catch (error) {
    console.error('[Inventory API] Search error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get all inventory from a specific table
 * GET /api/inventory/table/:tableName
 */
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;

    console.log(`[Inventory API] Getting all items from table: ${tableName}`);

    // Validate table name (prevent SQL injection)
    const validTables = [
      'bins_inventory',
      'stock_room',
      'md82_parts',
      '727_parts',
      'terra',
      'asia_ar_parts',
      'b_e_r__r_a_i',
      'bolivia_part',
      'delta_apa',
      'asia_ar_sanford_parts',
      'apa_sanford_ar_757'
    ];

    if (!validTables.includes(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);
    res.json(rows);
  } catch (error) {
    console.error('[Inventory API] Table query error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get stock room inventory with filters
 * GET /api/inventory/stock-room
 */
router.get('/stock-room', async (req, res) => {
  try {
    const { location, condition, search } = req.query;

    let query = 'SELECT * FROM stock_room WHERE 1=1';
    const params = [];

    if (location) {
      query += ' AND LOCATION = ?';
      params.push(location);
    }

    if (condition) {
      query += ' AND COND = ?';
      params.push(condition);
    }

    if (search) {
      query += ' AND (PN LIKE ? OR DESCRIPTION LIKE ? OR SERIAL LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('[Inventory API] Stock room query error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get bins inventory with filters
 * GET /api/inventory/bins
 */
router.get('/bins', async (req, res) => {
  try {
    const { location, bin, search } = req.query;

    let query = 'SELECT * FROM bins_inventory WHERE 1=1';
    const params = [];

    if (location) {
      query += ' AND LOCATION LIKE ?';
      params.push(`%${location}%`);
    }

    if (bin) {
      query += ' AND BIN_ = ?';
      params.push(bin);
    }

    if (search) {
      query += ' AND (PART_NUMBER LIKE ? OR DESCRIPTION LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('[Inventory API] Bins query error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get all tables list
 * GET /api/inventory/tables
 */
router.get('/tables', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT TABLE_NAME as tableName, TABLE_ROWS as rowCount
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_ROWS DESC
    `, [process.env.DB_NAME || 'genthrust_inventory']);

    res.json(rows);
  } catch (error) {
    console.error('[Inventory API] Tables list error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Decrement inventory quantity
 * POST /api/inventory/decrement
 */
router.post('/decrement', async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { indexId, partNumber, roNumber, notes } = req.body;

    if (!indexId || !partNumber) {
      return res.status(400).json({ error: 'indexId and partNumber are required' });
    }

    console.log(`[Inventory API] Decrementing inventory: ${partNumber}`);

    await connection.beginTransaction();

    // Get item from index
    const [indexRows] = await connection.query(
      'SELECT * FROM inventoryindex WHERE IndexId = ?',
      [indexId]
    );

    if (indexRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const item = indexRows[0];
    const currentQty = parseInt(item.Qty) || 0;

    if (currentQty < 1) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Insufficient quantity',
        message: 'Cannot decrement below 0'
      });
    }

    const newQty = currentQty - 1;

    // Update index table
    await connection.query(
      'UPDATE inventoryindex SET Qty = ? WHERE IndexId = ?',
      [newQty, indexId]
    );

    // Log transaction
    await connection.query(
      `INSERT INTO transactions (TxnId, Timestamp, Action, PartNumber, DeltaQty, NewQty, TableName, RowId, RONumber, User, Note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        new Date().toISOString(),
        'DECREMENT',
        partNumber,
        -1,
        newQty,
        item.TableName,
        item.RowId,
        roNumber || null,
        'System',
        notes || 'Quantity decremented'
      ]
    );

    await connection.commit();

    const isLowStock = newQty < 2;

    res.json({
      success: true,
      newQty,
      isLowStock,
      message: isLowStock
        ? `Decremented to ${newQty} - LOW STOCK WARNING!`
        : `Decremented to ${newQty}`
    });
  } catch (error) {
    await connection.rollback();
    console.error('[Inventory API] Decrement error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  } finally {
    connection.release();
  }
});

/**
 * Get inventory statistics
 * GET /api/inventory/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [totalItems] = await db.query(
      'SELECT COUNT(*) as count FROM inventoryindex'
    );

    const [totalQty] = await db.query(
      'SELECT SUM(Qty) as total FROM inventoryindex'
    );

    const [lowStock] = await db.query(
      'SELECT COUNT(*) as count FROM inventoryindex WHERE Qty < 2'
    );

    const [recentTransactions] = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE Timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    res.json({
      totalItems: totalItems[0].count,
      totalQuantity: totalQty[0].total || 0,
      lowStockCount: lowStock[0].count,
      recentTransactions: recentTransactions[0].count
    });
  } catch (error) {
    console.error('[Inventory API] Stats error:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

/**
 * Get low stock parts with usage analysis and supplier data
 * GET /api/inventory/low-stock?threshold=5
 *
 * Returns parts below threshold with:
 * - Current quantity
 * - 90-day usage rate
 * - Recommended reorder quantity
 * - Supplier information (if available via RO history)
 */
router.get('/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;

    console.log(`[Inventory API] Getting low stock parts (threshold: ${threshold})`);

    // Query low stock items with 90-day usage analysis
    const [lowStockItems] = await db.query(
      `SELECT
        idx.IndexId as indexId,
        idx.PartNumber as partNumber,
        idx.TableName as tableName,
        idx.RowId as rowId,
        idx.SerialNumber as serialNumber,
        idx.Qty as currentQty,
        idx.\`Condition\` as \`condition\`,
        idx.Location as location,
        idx.Description as description,
        idx.LastSeen as lastSeen,
        -- Calculate 90-day usage from transactions
        COALESCE(ABS(SUM(CASE
          WHEN txn.Action = 'DECREMENT' AND txn.Timestamp > DATE_SUB(NOW(), INTERVAL 90 DAY)
          THEN txn.DeltaQty
          ELSE 0
        END)), 0) as usage90Days,
        -- Count of transactions in last 90 days
        COUNT(CASE
          WHEN txn.Timestamp > DATE_SUB(NOW(), INTERVAL 90 DAY)
          THEN 1
          ELSE NULL
        END) as transactionCount90Days,
        -- Most recent transaction date
        MAX(txn.Timestamp) as lastUsedDate,
        -- Most recent RO that used this part
        (SELECT txn2.RONumber
         FROM transactions txn2
         WHERE txn2.PartNumber = idx.PartNumber
           AND txn2.RONumber IS NOT NULL
         ORDER BY txn2.Timestamp DESC
         LIMIT 1) as lastRONumber
      FROM inventoryindex idx
      LEFT JOIN transactions txn ON txn.PartNumber = idx.PartNumber
      WHERE idx.Qty <= ?
      GROUP BY
        idx.IndexId, idx.PartNumber, idx.TableName, idx.RowId,
        idx.SerialNumber, idx.Qty, idx.\`Condition\`, idx.Location,
        idx.Description, idx.LastSeen
      ORDER BY idx.Qty ASC, usage90Days DESC`,
      [threshold]
    );

    // Calculate reorder quantities and format response
    const results = lowStockItems.map(item => {
      const usage90Days = parseFloat(item.usage90Days) || 0;
      const currentQty = parseInt(item.currentQty) || 0;

      // Calculate average monthly usage
      const monthlyUsage = usage90Days / 3;

      // Reorder quantity: 3 months of usage, minimum 5 units, minus current quantity
      const recommendedReorder = Math.max(
        Math.ceil(monthlyUsage * 3) - currentQty,
        5 - currentQty,
        0
      );

      // Determine urgency level
      let urgency = 'low';
      if (currentQty === 0) {
        urgency = 'critical';
      } else if (currentQty <= 2 && monthlyUsage > 0) {
        urgency = 'high';
      } else if (currentQty <= threshold / 2) {
        urgency = 'medium';
      }

      return {
        indexId: item.indexId?.toString(),
        partNumber: item.partNumber,
        tableName: item.tableName,
        rowId: item.rowId?.toString(),
        serialNumber: item.serialNumber,
        currentQty,
        condition: item.condition,
        location: item.location,
        description: item.description,
        lastSeen: item.lastSeen,
        usage90Days,
        transactionCount90Days: parseInt(item.transactionCount90Days) || 0,
        monthlyUsageRate: parseFloat(monthlyUsage.toFixed(2)),
        lastUsedDate: item.lastUsedDate,
        lastRONumber: item.lastRONumber,
        recommendedReorder,
        urgency,
        daysUntilStockout: monthlyUsage > 0
          ? Math.floor((currentQty / monthlyUsage) * 30)
          : null
      };
    });

    console.log(`[Inventory API] Found ${results.length} low stock parts`);
    res.json({
      threshold,
      totalLowStockItems: results.length,
      criticalItems: results.filter(r => r.urgency === 'critical').length,
      highUrgencyItems: results.filter(r => r.urgency === 'high').length,
      items: results
    });
  } catch (error) {
    console.error('[Inventory API] Low stock query error:', error);
    res.status(500).json({
      error: 'Database error',
      message: error.message
    });
  }
});

export default router;
