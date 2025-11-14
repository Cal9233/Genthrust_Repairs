# Inventory System Setup Guide

## 📋 Step-by-Step Setup Instructions

### Prerequisites
- [ ] Backup `Genthrust_Inventory.xlsx` (save as `Genthrust_Inventory_BACKUP_[date].xlsx`)
- [ ] Create test copy: `Genthrust_Inventory_TEST.xlsx`
- [ ] Open test copy in **Excel Desktop** (not Excel Online)

---

## Phase 1: Convert Sheets to Excel Tables

### Table Naming Convention

Convert each inventory sheet to a table using these **exact names**:

| Sheet Name | Table Name (use exactly) |
|------------|--------------------------|
| Bins Inventory | `BinsInventoryTable` |
| Stock Room | `StockRoomInventoryTable` |
| MD82 Parts | `MD82PartsTable` |
| 727 Parts | `727PartsTable` |
| TERRA | `TERRAInventoryTable` |
| BER/RAI | `BER_RAI_Table` |
| PARTES AR ASIA | `PARTES_AR_ASIA_Table` |
| PARTES AR ASIA SANFORD | `PARTES_AR_ASIA_SANFORD_Table` |
| PARTES BOLIVIA | `PARTES_BOLIVIA_Table` |
| DELTA APA | `DELTA_APA_Table` |

### Conversion Steps (Repeat for Each Sheet)

1. **Select Sheet**: Click on the sheet tab (e.g., "Bins Inventory")

2. **Select Data**: Click any cell in your data (Excel will auto-detect the range)

3. **Create Table**:
   - Press **Ctrl+T**
   - OR: Ribbon → **Insert** → **Table**

4. **Verify Range**: Excel shows detected range
   - ✅ Check **"My table has headers"**
   - Click **OK**

5. **Name the Table**:
   - Table Design tab appears (ribbon)
   - Find **Table Name** field (top-left of ribbon)
   - Enter the table name from table above
   - Press **Enter**

6. **Verify**:
   - Table Design tab still selected
   - Table Name field shows your name
   - Data has colored header row with filter dropdowns

7. **Save** (Ctrl+S)

### Quick Verification

After converting all sheets:
1. Press **Ctrl+F3** (Name Manager)
2. You should see all 10 table names in the list
3. Close Name Manager

---

## Phase 2: Create Index Tables

### 2.1 Create InventoryIndexTable

**Purpose**: Fast search index across all inventory tables

**Steps**:
1. **Insert New Sheet**:
   - Right-click sheet tabs → Insert → Worksheet
   - Name it **"InventoryIndex"**

2. **Add Headers** (paste these into row 1, columns A-L):
   ```
   IndexId | PartNumber | TableName | RowId | SerialNumber | Qty | Condition | Location | Description | LastSeen | ETag | ExtraMeta
   ```

3. **Create Table**:
   - Select A1:L1 (just the headers)
   - Press Ctrl+T
   - ✅ Check "My table has headers"
   - Click OK

4. **Name Table**:
   - Table Design → Table Name: **`InventoryIndexTable`**
   - Press Enter

5. **Format Columns** (optional but recommended):
   - Select column A (IndexId) → Format → Text
   - Select column B (PartNumber) → Format → Text
   - Select column F (Qty) → Format → Number
   - Select column J (LastSeen) → Format → Date

6. **Save**

### 2.2 Create InventoryTransactionsTable

**Purpose**: Audit log of all inventory changes

**Steps**:
1. **Insert New Sheet**:
   - Right-click sheet tabs → Insert → Worksheet
   - Name it **"Transactions"**

2. **Add Headers** (paste these into row 1, columns A-K):
   ```
   TxnId | Timestamp | Action | PartNumber | DeltaQty | NewQty | TableName | RowId | RONumber | User | Note
   ```

3. **Create Table**:
   - Select A1:K1 (just the headers)
   - Press Ctrl+T
   - ✅ Check "My table has headers"
   - Click OK

4. **Name Table**:
   - Table Design → Table Name: **`InventoryTransactionsTable`**
   - Press Enter

5. **Format Columns**:
   - Column A (TxnId) → Text
   - Column B (Timestamp) → Date/Time
   - Column C (Action) → Text
   - Column E (DeltaQty) → Number
   - Column F (NewQty) → Number

6. **Save**

---

## Phase 3: Upload to SharePoint

### Upload Test File

1. **Save Excel File** (Ctrl+S)
2. **Go to SharePoint**:
   - Navigate to your SharePoint site
   - Documents → GenThrust → Inventory (or your folder)
3. **Upload**:
   - Upload `Genthrust_Inventory_TEST.xlsx`
4. **Get File ID**:
   - Right-click file → Share → Copy link
   - The URL will look like:
     ```
     https://yourcompany.sharepoint.com/:x:/r/sites/.../Genthrust_Inventory_TEST.xlsx?d=ABC123DEF456&...
     ```
   - Copy the ID after `d=` (the long random string before `&`)
   - Example: `ABC123DEF456` ← this is your file ID

5. **Add to .env.local**:
   ```env
   VITE_INVENTORY_WORKBOOK_ID=ABC123DEF456
   ```

---

## Phase 4: Install Dependencies & Verify

### Install New Packages

From the `repair-dashboard` directory:

```bash
npm install
```

This will install:
- `@microsoft/microsoft-graph-client` - Graph API SDK
- `@azure/msal-node` - Authentication for Node scripts
- `dotenv` - Environment variable loading
- `uuid` - Unique ID generation

### Run Verification Script

```bash
npm run verify-inventory
```

**Expected Output** (after tables are created):
```
🔍 Verifying Inventory Excel Tables...

🔐 Authentication Required:
To sign in, use a web browser to open the page https://microsoft.com/devicelogin
and enter the code ABC-DEF-123 to authenticate.

✅ Authenticated successfully

📊 Fetching worksheets...
Found 12 worksheets:
  1. Bins Inventory
  2. Stock Room
  3. MD82 Parts
  ...
  11. InventoryIndex
  12. Transactions

📋 Fetching Excel Tables...
Found 12 Excel Tables:
  ✅ 1. BinsInventoryTable
  ✅ 2. StockRoomInventoryTable
  ✅ 3. MD82PartsTable
  ...
  ✅ 11. InventoryIndexTable
  ✅ 12. InventoryTransactionsTable

🔍 Checking for missing tables...

✅ All expected tables are present!

📊 Table Details:
================================================================================

📋 BinsInventoryTable
   Columns (8):
      [0] PART NUMBER
      [1] DESCRIPTION
      [2] QTY
      [3] LOCATION
      [4] BIN #
      [5] CONDITION
      [6] SERIAL
      [7] COST

...

================================================================================

✅ Verification complete!
```

**If tables are missing**, the script will tell you exactly which ones need to be created.

---

## Phase 5: Build the Index

### Run Index Builder Script

Once all tables are verified, run:

```bash
npm run build-inventory-index
```

**What it does**:
1. Reads all 10 inventory tables
2. Normalizes part numbers (removes spaces, hyphens, uppercase)
3. Populates `InventoryIndexTable` with searchable entries
4. Shows progress as it processes ~6,000 rows

**Expected Output**:
```
🔨 Building Inventory Index...

🔐 Authentication Required:
[Device code flow]

✅ Authenticated successfully

📊 Processing BinsInventoryTable...
   Added 524 parts to index

📊 Processing StockRoomInventoryTable...
   Added 1,203 parts to index

...

✅ Index build complete!
   Total parts indexed: 6,234
   Build time: 2m 34s
```

---

## Column Mappings Reference

### BinsInventoryTable
```
[0] PART NUMBER
[1] DESCRIPTION
[2] QTY
[3] LOCATION
[4] BIN #
[5] CONDITION
[6] SERIAL (optional)
[7] COST (optional)
```

### StockRoomInventoryTable
```
[0] PN
[1] SERIAL
[2] DESCRIPTION
[3] QTY
[4] LOCATION
[5] COND
[6] TAG DATE
[7] PO COST
[8] RO COST
```

### MD82PartsTable / 727PartsTable / TERRAInventoryTable
```
[0] PART No.
[1] SERIAL
[2] DESCRIPTION
[3] QTY
[4] STOCK ROOM
[5] LOCATION
[6] BIN (optional)
[7] COMMENT (optional)
```

### BER_RAI_Table
```
[0] PART No.
[1] SERIAL
[2] DESCRIPTION
[3] QTY
[4] STOCK ROOM
[5] COMMENT
[6] PO (optional)
```

### PARTES Tables (AR ASIA, AR ASIA SANFORD, BOLIVIA, DELTA APA)
```
[0] PART No.
[1] SERIAL
[2] DESCRIPTION
[3] QTY
[4] STOCK ROOM / LOCATION
[5] COMMENT / AR / PO (varies by table)
```

---

## Troubleshooting

### "Table not found" error
- **Cause**: Sheet wasn't converted to table properly
- **Fix**: Repeat conversion steps, verify table name in Name Manager

### "Headers not found" error
- **Cause**: Table was created without checking "My table has headers"
- **Fix**: Delete table (Table Design → Convert to Range), re-create with headers checked

### Verification script shows missing tables
- **Cause**: Table name doesn't match exactly (case-sensitive!)
- **Fix**: Open Name Manager, rename table to exact name from guide

### Index build fails on specific table
- **Cause**: Table has unexpected column structure
- **Fix**: Check column mappings above, verify headers match

### Authentication fails in scripts
- **Cause**: Azure AD app doesn't have required permissions
- **Fix**: Ensure app has `Files.ReadWrite.All` and `Sites.Read.All` permissions

---

## Next Steps

After completing Phases 1-5:
1. ✅ All sheets converted to tables
2. ✅ Index and Transaction tables created
3. ✅ Verification script passes
4. ✅ Index built successfully

**You're ready for Phase 1B**: Implementing the inventory service in the React app!

Return to the main development flow and let me know when you're ready to continue.
