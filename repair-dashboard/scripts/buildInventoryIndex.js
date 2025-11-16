/**
 * Build Inventory Index Script
 * Populates InventoryIndexTable with normalized data from all inventory tables
 *
 * This creates a fast search index by:
 * 1. Reading all 11 inventory tables
 * 2. Auto-detecting column structures
 * 3. Normalizing part numbers (uppercase, no spaces/hyphens)
 * 4. Creating index entries with pointers to source tables
 *
 * Usage:
 *   node scripts/buildInventoryIndex.js
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication } from '@azure/msal-node';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Configuration
const config = {
  auth: {
    clientId: process.env.VITE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.VITE_TENANT_ID}`,
  },
};

const WORKBOOK_ID = process.env.VITE_INVENTORY_WORKBOOK_ID;
const SITE_URL = process.env.VITE_SHAREPOINT_SITE_URL;
const INDEX_TABLE = 'InventoryIndexTable';

let driveId = null; // Cache the drive ID

// Inventory tables to process
const INVENTORY_TABLES = [
  'BinsInventoryTable',
  'StockRoomInventoryTable',
  'MD82PartsTable',
  'Inventory_727PartsTable',
  'TERRAInventoryTable',
  'BER_RAI_Table',
  'ASIS_AR_PARTS_Table',
  'PARTS_AR_ASIA_SANFORD_Table',
  'BOLIVIA_PART_TABLE',
  'DELTA_APA_TABLE',
  'APA_SANFORD_757_TABLE',
];

// Display names for tables
const TABLE_DISPLAY_NAMES = {
  'BinsInventoryTable': 'Bins Inventory',
  'StockRoomInventoryTable': 'Stock Room',
  'MD82PartsTable': 'MD82 Parts',
  'Inventory_727PartsTable': '727 Parts',
  'TERRAInventoryTable': 'TERRA',
  'BER_RAI_Table': 'BER/RAI',
  'ASIS_AR_PARTS_Table': 'ASIS AR Parts',
  'PARTS_AR_ASIA_SANFORD_Table': 'AR Asia Sanford',
  'BOLIVIA_PART_TABLE': 'Bolivia Parts',
  'DELTA_APA_TABLE': 'Delta APA',
  'APA_SANFORD_757_TABLE': 'APA Sanford 757',
};

/**
 * Normalize part number for consistent searching
 * - Convert to uppercase
 * - Remove whitespace only (spaces, tabs, newlines)
 * - KEEP dashes and hyphens (they indicate part variants!)
 */
function normalizePartNumber(pn) {
  if (!pn) return '';
  return String(pn)
    .toUpperCase()
    .replace(/\s+/g, '') // Remove whitespace only, NOT dashes
    .trim();
}

/**
 * Auto-detect column indices by looking for common patterns in headers
 */
function detectColumnIndices(headers) {
  const findColumn = (patterns) => {
    return headers.findIndex(header => {
      if (!header) return false;
      const h = String(header).toUpperCase();
      return patterns.some(pattern => h.includes(pattern));
    });
  };

  return {
    partNumber: findColumn(['PART', 'PN', 'P/N', 'PART NO', 'PARTNUMBER']),
    serial: findColumn(['SERIAL', 'SER', 'S/N', 'SN']),
    qty: findColumn(['QTY', 'QUANTITY', 'QTY.']),
    condition: findColumn(['COND', 'CONDITION']),
    location: findColumn(['LOCATION', 'LOC', 'BIN', 'STOCK ROOM']),
    description: findColumn(['DESC', 'DESCRIPTION']),
  };
}

/**
 * Get the SharePoint drive ID
 */
async function getDriveId(client) {
  if (driveId) {
    return driveId; // Return cached value
  }

  const url = new URL(SITE_URL);
  const hostname = url.hostname;
  const sitePath = url.pathname;

  console.log(`🔍 Getting SharePoint site ID from ${hostname}:${sitePath}...`);

  // Get site ID
  const siteResponse = await client
    .api(`/sites/${hostname}:${sitePath}`)
    .get();

  console.log(`   Site ID: ${siteResponse.id}`);

  // Get drive ID
  const driveResponse = await client
    .api(`/sites/${siteResponse.id}/drive`)
    .get();

  driveId = driveResponse.id;
  console.log(`   Drive ID: ${driveId}\n`);

  return driveId;
}

/**
 * Clear existing index data
 */
async function clearIndex(client, sessionId) {
  console.log('🗑️  Clearing existing index data...');

  const drive = await getDriveId(client);

  try {
    // Get all rows
    const response = await client
      .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/tables/${INDEX_TABLE}/rows`)
      .header('workbook-session-id', sessionId)
      .get();

    const rows = response.value || [];
    const rowCount = rows.length;

    if (rowCount === 0) {
      console.log('   Index is already empty\n');
      return;
    }

    // Delete rows from bottom to top to avoid index shifting issues
    for (let i = rows.length - 1; i >= 0; i--) {
      try {
        await client
          .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/tables/${INDEX_TABLE}/rows/itemAt(index=${i})`)
          .header('workbook-session-id', sessionId)
          .delete();
      } catch (err) {
        // Continue on error
      }
    }

    console.log(`   ✅ Cleared ${rowCount} existing rows\n`);
  } catch (error) {
    console.log('   Index is already empty\n');
  }
}

/**
 * Process a single inventory table
 */
async function processTable(client, sessionId, tableName) {
  console.log(`📊 Processing ${TABLE_DISPLAY_NAMES[tableName] || tableName}...`);

  const drive = await getDriveId(client);

  try {
    // Get table rows
    const response = await client
      .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/tables/${tableName}/rows`)
      .header('workbook-session-id', sessionId)
      .get();

    const rows = response.value || [];

    if (rows.length === 0) {
      console.log(`   ⚠️  Table is empty, skipping\n`);
      return 0;
    }

    // First row should be data (headers are already in table definition)
    const firstRow = rows[0].values[0];

    // Get column headers from table
    const columnsResponse = await client
      .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/tables/${tableName}/columns`)
      .header('workbook-session-id', sessionId)
      .get();

    const headers = columnsResponse.value.map(col => col.name);

    // Auto-detect column indices
    const indices = detectColumnIndices(headers);

    console.log(`   Detected columns:`);
    console.log(`   - Part Number: [${indices.partNumber}] ${headers[indices.partNumber] || 'NOT FOUND'}`);
    console.log(`   - Qty: [${indices.qty}] ${headers[indices.qty] || 'NOT FOUND'}`);
    console.log(`   - Location: [${indices.location}] ${headers[indices.location] || 'NOT FOUND'}`);

    if (indices.partNumber === -1) {
      console.log(`   ❌ Could not detect Part Number column, skipping table\n`);
      return 0;
    }

    let processedCount = 0;
    const indexEntries = [];

    // Process each row
    for (const row of rows) {
      const values = row.values[0];
      const partNumber = values[indices.partNumber];

      if (!partNumber || String(partNumber).trim() === '') {
        continue; // Skip rows without part numbers
      }

      const normalized = normalizePartNumber(partNumber);
      const serial = indices.serial !== -1 ? values[indices.serial] || '' : '';
      const qty = indices.qty !== -1 ? Number(values[indices.qty]) || 0 : 0;
      const condition = indices.condition !== -1 ? values[indices.condition] || '' : '';
      const location = indices.location !== -1 ? values[indices.location] || '' : '';
      const description = indices.description !== -1 ? values[indices.description] || '' : '';

      // Create index entry
      // Force part number as text by prepending apostrophe to prevent scientific notation
      const indexEntry = [
        uuidv4(),                    // IndexId
        `'${normalized}`,             // PartNumber (force text format with apostrophe)
        tableName,                    // TableName
        String(row.index),           // RowId
        String(serial),              // SerialNumber
        qty,                         // Qty
        String(condition),           // Condition
        String(location),            // Location
        String(description),         // Description
        new Date().toISOString(),    // LastSeen
        '',                          // ETag (will be populated on updates)
        ''                           // ExtraMeta
      ];

      indexEntries.push(indexEntry);
      processedCount++;
    }

    // Batch insert index entries (Graph API has limits, so batch in chunks)
    const BATCH_SIZE = 100;
    for (let i = 0; i < indexEntries.length; i += BATCH_SIZE) {
      const batch = indexEntries.slice(i, i + BATCH_SIZE);

      for (const entry of batch) {
        try {
          await client
            .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/tables/${INDEX_TABLE}/rows/add`)
            .header('workbook-session-id', sessionId)
            .post({ values: [entry] });
        } catch (error) {
          console.error(`   ⚠️  Failed to add row: ${error.message}`);
        }
      }

      const progress = Math.min(i + BATCH_SIZE, indexEntries.length);
      console.log(`   Progress: ${progress}/${indexEntries.length} rows`);
    }

    console.log(`   ✅ Added ${processedCount} parts to index\n`);
    return processedCount;

  } catch (error) {
    console.error(`   ❌ Error processing table: ${error.message}\n`);
    return 0;
  }
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();

  console.log('🔨 Building Inventory Index...\n');

  if (!WORKBOOK_ID) {
    console.error('❌ Error: VITE_INVENTORY_WORKBOOK_ID not found in .env.local');
    process.exit(1);
  }

  if (!SITE_URL) {
    console.error('❌ Error: VITE_SHAREPOINT_SITE_URL not found in .env.local');
    process.exit(1);
  }

  // Initialize MSAL
  const pca = new PublicClientApplication(config);

  try {
    // Device code authentication
    const deviceCodeRequest = {
      deviceCodeCallback: (response) => {
        console.log('🔐 Authentication Required:');
        console.log(response.message);
        console.log('');
      },
      scopes: ['Files.ReadWrite.All', 'Sites.Read.All'],
    };

    const authResponse = await pca.acquireTokenByDeviceCode(deviceCodeRequest);

    // Initialize Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, authResponse.accessToken);
      },
    });

    console.log('✅ Authenticated successfully\n');

    // Get SharePoint drive ID
    const drive = await getDriveId(client);

    // Create workbook session
    console.log('📂 Creating workbook session...');
    const sessionResponse = await client
      .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/createSession`)
      .post({ persistChanges: true });

    const sessionId = sessionResponse.id;
    console.log(`   Session ID: ${sessionId}\n`);

    try {
      // Clear existing index
      await clearIndex(client, sessionId);

      // Process each inventory table
      let totalProcessed = 0;

      for (const tableName of INVENTORY_TABLES) {
        const count = await processTable(client, sessionId, tableName);
        totalProcessed += count;
      }

      // Close session
      console.log('💾 Closing workbook session...');
      await client
        .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/closeSession`)
        .header('workbook-session-id', sessionId)
        .post();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('\n' + '='.repeat(60));
      console.log('✅ Index build complete!');
      console.log(`   Total parts indexed: ${totalProcessed}`);
      console.log(`   Build time: ${duration}s`);
      console.log('='.repeat(60));

    } catch (error) {
      // Try to close session even on error
      try {
        const drive = await getDriveId(client);
        await client
          .api(`/drives/${drive}/items/${WORKBOOK_ID}/workbook/closeSession`)
          .header('workbook-session-id', sessionId)
          .post();
      } catch (closeError) {
        // Ignore close errors
      }
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data || error.response);
    }
    process.exit(1);
  }
}

main();
