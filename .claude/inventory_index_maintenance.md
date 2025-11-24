# Inventory Index Maintenance Guide

## Purpose
This guide documents the maintenance procedures for the `inventoryindex` table in Aiven MySQL, which powers the fast inventory search functionality in the GenThrust RO Tracker.

---

## Overview

The `inventoryindex` table is a denormalized index that aggregates inventory data from multiple source tables for fast search performance.

**Source Tables:**
- `bins_inventory_actual` - 4192+ rows from Bins Inventory Excel sheet
- `stock_room_actual` - 1072+ rows from Stock Room Excel sheet

**Purpose:**
- Enable fast part number searches across all inventory locations
- Provide unified inventory view without querying multiple tables
- Support fuzzy/partial matching for part numbers
- Track inventory quantities and locations

---

## Schema

```sql
CREATE TABLE IF NOT EXISTS inventoryindex (
    IndexId INT AUTO_INCREMENT PRIMARY KEY,
    PartNumber VARCHAR(255),
    TableName VARCHAR(100),
    RowId INT,
    Qty INT,
    SerialNumber VARCHAR(255),
    `Condition` VARCHAR(50),
    Location VARCHAR(255),
    Description TEXT,
    LastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_partnumber (PartNumber),
    INDEX idx_qty (Qty)
);
```

**Column Descriptions:**
- `IndexId` - Auto-incrementing primary key
- `PartNumber` - Part number from source tables (indexed for fast search)
- `TableName` - Source table name ('bins_inventory_actual' or 'stock_room_actual')
- `RowId` - Reference to the row ID in the source table
- `Qty` - Quantity available (0 for non-numeric values)
- `SerialNumber` - Serial number if applicable
- `Condition` - Part condition (NEW, SERVICEABLE, REPAIRABLE, etc.)
- `Location` - Warehouse location/bin identifier
- `Description` - Part description
- `LastSeen` - Timestamp of when part was last recorded

---

## Initial Population Script

Run this SQL script in DBeaver connected to Aiven MySQL to populate the index:

```sql
-- 1. Clear existing data
TRUNCATE TABLE inventoryindex;

-- 2. Populate from bins_inventory_actual
INSERT INTO inventoryindex (PartNumber, TableName, RowId, Qty, SerialNumber, `Condition`, Location, Description)
SELECT
    PART_NUMBER,
    'bins_inventory_actual',
    id,
    CASE
        WHEN QTY REGEXP '^[0-9]+$' THEN CAST(QTY AS UNSIGNED)
        ELSE 0
    END as Qty,
    NULL,  -- bins_inventory_actual doesn't have serial numbers
    `CONDITION`,
    LOCATION,
    DESCRIPTION
FROM bins_inventory_actual
WHERE PART_NUMBER IS NOT NULL AND TRIM(PART_NUMBER) != '';

-- 3. Populate from stock_room_actual
INSERT INTO inventoryindex (PartNumber, TableName, RowId, Qty, SerialNumber, `Condition`, Location, Description, LastSeen)
SELECT
    GENTHRUST_XVII_INVENTORY,
    'stock_room_actual',
    id,
    1,  -- Default quantity since stock_room_actual doesn't have QTY column
    NULL,  -- No serial number
    NULL,  -- No condition
    NULL,  -- No location
    NULL,  -- No description
    created_at
FROM stock_room_actual
WHERE GENTHRUST_XVII_INVENTORY IS NOT NULL AND TRIM(GENTHRUST_XVII_INVENTORY) != '';

-- 4. Verify the data was loaded
SELECT
    COUNT(*) as total_items,
    SUM(Qty) as total_quantity,
    COUNT(DISTINCT PartNumber) as unique_parts,
    COUNT(CASE WHEN TableName = 'bins_inventory_actual' THEN 1 END) as from_bins,
    COUNT(CASE WHEN TableName = 'stock_room_actual' THEN 1 END) as from_stock_room
FROM inventoryindex;

-- 5. Show sample data
SELECT * FROM inventoryindex LIMIT 10;
```

**Expected Results:**
- Total items: 5264+
- From bins_inventory_actual: ~4192 rows
- From stock_room_actual: ~1072 rows

---

## Data Type Handling

### Non-Numeric Quantities

Some source tables store quantities as text, including dimension values like "4FT", "2.5M", etc.

**Problem:** `CAST(QTY AS UNSIGNED)` fails with error:
```
Truncated incorrect INTEGER value: '4FT'
```

**Solution:** Use REGEXP to validate numeric values before casting:
```sql
CASE
    WHEN QTY REGEXP '^[0-9]+$' THEN CAST(QTY AS UNSIGNED)
    ELSE 0
END as Qty
```

**Behavior:**
- Numeric strings ("5", "100") → Converted to integers
- Non-numeric strings ("4FT", "2.5M") → Stored as 0
- NULL values → Handled by `COALESCE(QTY, 0)`

---

## Maintenance Procedures

### When to Refresh the Index

Refresh the `inventoryindex` table when:
1. **Excel inventory sheets are updated** with new parts or quantities
2. **New source tables are added** to the database
3. **Quarterly inventory audits** are completed
4. **Data discrepancies** are detected between search results and source tables

### How to Refresh

Run the full population script (see "Initial Population Script" above). This will:
1. Clear all existing index data
2. Re-populate from current source tables
3. Validate data integrity

**Execution Time:** ~2-5 seconds for 5000+ rows

**Downtime:** None - inventory searches will return empty results briefly during truncate/insert

---

## Adding New Source Tables

To add a new inventory source table to the index:

1. **Identify column mappings** from the new source table:
   - Part Number column
   - Quantity column
   - Condition/Location/Description columns (if available)

2. **Add INSERT statement** to the population script:
```sql
INSERT INTO inventoryindex (PartNumber, TableName, RowId, Qty, SerialNumber, `Condition`, Location, Description)
SELECT
    YOUR_PART_NUMBER_COLUMN,
    'your_table_name',
    id,
    CASE
        WHEN YOUR_QTY_COLUMN REGEXP '^[0-9]+$' THEN CAST(YOUR_QTY_COLUMN AS UNSIGNED)
        ELSE 0
    END as Qty,
    YOUR_SERIAL_COLUMN,
    YOUR_CONDITION_COLUMN,
    YOUR_LOCATION_COLUMN,
    YOUR_DESCRIPTION_COLUMN
FROM your_table_name
WHERE YOUR_PART_NUMBER_COLUMN IS NOT NULL AND TRIM(YOUR_PART_NUMBER_COLUMN) != '';
```

3. **Test the query** to verify column mappings are correct

4. **Run the full population script** to rebuild the index with new data

---

## Troubleshooting

### Issue: "Table 'defaultdb.inventoryindex' doesn't exist"

**Cause:** Index table was dropped or never created

**Solution:** Run the schema creation script:
```sql
CREATE TABLE IF NOT EXISTS inventoryindex (
    IndexId INT AUTO_INCREMENT PRIMARY KEY,
    PartNumber VARCHAR(255),
    TableName VARCHAR(100),
    RowId INT,
    Qty INT,
    SerialNumber VARCHAR(255),
    `Condition` VARCHAR(50),
    Location VARCHAR(255),
    Description TEXT,
    LastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_partnumber (PartNumber),
    INDEX idx_qty (Qty)
);
```

Then run the population script.

---

### Issue: "Unknown column 'PART_NUMBER' in field list"

**Cause:** Source table column names don't match the INSERT statement

**Solution:**
1. Check actual column names in DBeaver:
   ```sql
   DESCRIBE bins_inventory_actual;
   ```
2. Update INSERT statement with correct column names

---

### Issue: Search returns 0 results for known parts

**Cause:** Index is empty or out of sync with source tables

**Solution:** Run the population script to refresh the index

**Verification:**
```sql
-- Check if index has data
SELECT COUNT(*) FROM inventoryindex;

-- Search for a known part
SELECT * FROM inventoryindex WHERE PartNumber = 'MS20470AD4-6';
```

---

### Issue: "Truncated incorrect INTEGER value: '4FT'"

**Cause:** QTY column contains non-numeric text values

**Solution:** Already implemented in the population script with REGEXP validation. Ensure you're using the CASE statement version:
```sql
CASE
    WHEN QTY REGEXP '^[0-9]+$' THEN CAST(QTY AS UNSIGNED)
    ELSE 0
END as Qty
```

---

## Performance Monitoring

### Query Performance Benchmarks

**Exact Match Search:**
```sql
SELECT * FROM inventoryindex WHERE UPPER(TRIM(PartNumber)) = 'MS20470AD4-6';
```
Expected: ~50-100ms

**Fuzzy/Partial Match Search:**
```sql
SELECT * FROM inventoryindex WHERE UPPER(TRIM(PartNumber)) LIKE '%387%' LIMIT 50;
```
Expected: ~100-200ms

**Slow Queries:**
If queries exceed 500ms consistently:
1. Check if indexes exist: `SHOW INDEX FROM inventoryindex;`
2. Rebuild indexes if needed:
   ```sql
   ALTER TABLE inventoryindex DROP INDEX idx_partnumber;
   ALTER TABLE inventoryindex ADD INDEX idx_partnumber (PartNumber);
   ```

---

## Backend Integration

The inventory search endpoint (`backend/routes/inventory.js`) uses a three-tier search strategy:

**Tier 1:** Exact match in inventoryindex
```javascript
SELECT * FROM inventoryindex
WHERE UPPER(TRIM(PartNumber)) = ?
```

**Tier 2:** LIKE match in inventoryindex
```javascript
SELECT * FROM inventoryindex
WHERE UPPER(TRIM(PartNumber)) LIKE ?
LIMIT 50
```

**Tier 3:** Direct search in source tables (fallback)
```javascript
-- Search in stock_room
SELECT * FROM stock_room WHERE UPPER(TRIM(PN)) = ? OR UPPER(TRIM(PN)) LIKE ?

-- Search in bins_inventory
SELECT * FROM bins_inventory WHERE UPPER(TRIM(PN)) = ? OR UPPER(TRIM(PN)) LIKE ?
```

**Note:** Tier 3 searches fallback tables (`stock_room`, `bins_inventory`) NOT the `_actual` tables. Ensure these fallback tables are also populated if used.

---

## Best Practices

1. **Schedule Regular Refreshes**
   - Monthly: After inventory Excel sheets are updated
   - Quarterly: During inventory audits
   - Ad-hoc: When data discrepancies are reported

2. **Validate After Refresh**
   - Check row counts match expected totals
   - Verify sample part numbers are searchable
   - Run performance benchmarks to ensure indexes are working

3. **Monitor Search Performance**
   - Review Netlify Functions logs for slow queries
   - Track search response times in production
   - Alert if queries exceed 500ms threshold

4. **Document Changes**
   - Update this guide when adding new source tables
   - Document any schema changes to inventoryindex
   - Keep SQL scripts version-controlled

---

## Related Files

- **Backend Route:** `backend/routes/inventory.js` (lines 10-117) - Inventory search endpoint
- **Backend Config:** `backend/config/database.js` - MySQL connection with SSL
- **Frontend Service:** `repair-dashboard/src/services/mysqlInventoryService.ts` - Frontend API client
- **Documentation:** `.claude/CHANGELOG.md` (v2.0.1) - Initial setup documentation

---

## Version History

**v1.0.0** - 2025-11-24
- Initial creation
- Documented population script with non-numeric QTY handling
- Added troubleshooting guide
- Documented maintenance procedures
