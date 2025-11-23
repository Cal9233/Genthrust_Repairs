// test-connection.js
// Integration test to verify Aiven Cloud MySQL connection

import { inventoryPool as db } from './config/database.js';

async function testInventory() {
    try {
        console.log("🔌 Connecting to Aiven Database...");

        // Query your actual table name from Aiven (bins_inventory_actual)
        const [rows] = await db.query('SELECT * FROM bins_inventory_actual LIMIT 5');

        console.log("✅ Connection Successful!");
        console.log("📦 First 5 items from inventory:");
        console.table(rows); // Prints a nice table in your console

        // Additional info
        console.log(`\n📊 Total rows retrieved: ${rows.length}`);
        console.log("🎯 Database: defaultdb @ Aiven Cloud");

    } catch (error) {
        console.error("❌ Error connecting:", error.message);
        console.error("\n🔍 Troubleshooting:");
        console.error("  - Check .env file has correct Aiven credentials");
        console.error("  - Verify ca.pem file exists in backend directory");
        console.error("  - Ensure Aiven firewall allows your IP");
    } finally {
        await db.end();
        process.exit();
    }
}

testInventory();
