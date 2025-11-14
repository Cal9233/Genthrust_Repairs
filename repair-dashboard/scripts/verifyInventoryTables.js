/**
 * Verify Inventory Excel Tables Script
 * Checks which sheets in Genthrust_Inventory.xlsx are properly formatted as Excel Tables
 *
 * Prerequisites:
 * - Excel file must be in SharePoint
 * - Must have valid MSAL authentication
 *
 * Usage:
 *   node scripts/verifyInventoryTables.js
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication } from '@azure/msal-node';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Configuration from environment
const config = {
  auth: {
    clientId: process.env.VITE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.VITE_TENANT_ID}`,
  },
};

// Expected table names based on actual Excel file structure
const EXPECTED_TABLES = [
  'APA_SANFORD_757_TABLE',
  'ASIS_AR_PARTS_Table',
  'BER_RAI_Table',
  'BinsInventoryTable',
  'BOLIVIA_PART_TABLE',
  'DELTA_APA_TABLE',
  'Inventory_727PartsTable',
  'MD82PartsTable',
  'PARTS_AR_ASIA_SANFORD_Table',  // Changed from PARTES to PARTS
  'StockRoomInventoryTable',
  'TERRAInventoryTable',
  'InventoryIndexTable',          // Index for fast search
  'InventoryTransactionsTable',   // Audit log
];

async function main() {
  console.log('🔍 Verifying Inventory Excel Tables...\n');

  // Get file ID from env or search for file
  const fileId = process.env.VITE_INVENTORY_WORKBOOK_ID;

  if (!fileId) {
    console.error('❌ Error: VITE_INVENTORY_WORKBOOK_ID not found in .env.local');
    console.log('Please add the file ID to your .env.local file:');
    console.log('VITE_INVENTORY_WORKBOOK_ID=<your-file-id>');
    console.log('\nYou can get the file ID from SharePoint by:');
    console.log('1. Right-click the file → Share → Copy link');
    console.log('2. The ID is in the URL after "sourcedoc="');
    process.exit(1);
  }

  // Initialize MSAL (device code flow for scripts)
  const pca = new PublicClientApplication(config);

  try {
    // Device code flow for authentication
    const deviceCodeRequest = {
      deviceCodeCallback: (response) => {
        console.log('\n🔐 Authentication Required:');
        console.log(response.message);
      },
      scopes: ['Files.ReadWrite.All', 'Sites.Read.All'],
    };

    const response = await pca.acquireTokenByDeviceCode(deviceCodeRequest);

    // Initialize Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, response.accessToken);
      },
    });

    console.log('\n✅ Authenticated successfully\n');

    // Get all worksheets
    console.log('📊 Fetching worksheets...');
    const worksheetsResponse = await client
      .api(`/me/drive/items/${fileId}/workbook/worksheets`)
      .get();

    const worksheets = worksheetsResponse.value || [];
    console.log(`Found ${worksheets.length} worksheets:\n`);

    worksheets.forEach((sheet, idx) => {
      console.log(`  ${idx + 1}. ${sheet.name}`);
    });

    // Get all tables
    console.log('\n📋 Fetching Excel Tables...');
    const tablesResponse = await client
      .api(`/me/drive/items/${fileId}/workbook/tables`)
      .get();

    const tables = tablesResponse.value || [];
    console.log(`Found ${tables.length} Excel Tables:\n`);

    if (tables.length === 0) {
      console.log('  ⚠️  No tables found! You need to convert sheets to tables.');
    } else {
      tables.forEach((table, idx) => {
        const isExpected = EXPECTED_TABLES.includes(table.name);
        const icon = isExpected ? '✅' : '⚠️';
        console.log(`  ${icon} ${idx + 1}. ${table.name}`);
      });
    }

    // Check for missing tables
    console.log('\n🔍 Checking for missing tables...\n');
    const existingTableNames = tables.map(t => t.name);
    const missingTables = EXPECTED_TABLES.filter(
      name => !existingTableNames.includes(name)
    );

    if (missingTables.length === 0) {
      console.log('✅ All expected tables are present!');
    } else {
      console.log(`❌ Missing ${missingTables.length} tables:\n`);
      missingTables.forEach((tableName, idx) => {
        console.log(`  ${idx + 1}. ${tableName}`);
      });

      console.log('\n📝 Action Required:');
      console.log('Convert the following sheets to Excel Tables:');
      missingTables
        .filter(name => !name.includes('Index') && !name.includes('Transactions'))
        .forEach((tableName) => {
          console.log(`  - ${tableName}`);
        });

      if (missingTables.includes('InventoryIndexTable')) {
        console.log('\n📌 Create InventoryIndexTable manually:');
        console.log('  1. Insert new sheet "InventoryIndex"');
        console.log('  2. Add headers (see documentation)');
        console.log('  3. Convert to table named "InventoryIndexTable"');
      }

      if (missingTables.includes('InventoryTransactionsTable')) {
        console.log('\n📌 Create InventoryTransactionsTable manually:');
        console.log('  1. Insert new sheet "Transactions"');
        console.log('  2. Add headers (see documentation)');
        console.log('  3. Convert to table named "InventoryTransactionsTable"');
      }
    }

    // Table details
    console.log('\n\n📊 Table Details:\n');
    console.log('=' .repeat(80));

    for (const table of tables) {
      try {
        const columnsResponse = await client
          .api(`/me/drive/items/${fileId}/workbook/tables/${table.name}/columns`)
          .get();

        const columns = columnsResponse.value || [];

        console.log(`\n📋 ${table.name}`);
        console.log(`   Columns (${columns.length}):`);
        columns.forEach((col, idx) => {
          console.log(`      [${idx}] ${col.name}`);
        });
      } catch (error) {
        console.log(`\n📋 ${table.name}`);
        console.log(`   ⚠️  Could not fetch columns: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Verification complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data || error.response);
    }
    process.exit(1);
  }
}

main();
