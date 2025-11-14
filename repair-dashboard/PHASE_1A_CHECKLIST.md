# Phase 1A Quick Win - Action Checklist ✅

## What I've Set Up For You

✅ **Dependencies Installed**:

- `@microsoft/microsoft-graph-client` - Graph API SDK
- `@azure/msal-node` - Node.js authentication
- `dotenv` - Environment variables
- `uuid` - Unique IDs

✅ **Scripts Created**:

- `npm run verify-inventory` - Check table status
- `npm run build-inventory-index` - Build search index

✅ **Documentation Created**:

- `INVENTORY_SETUP_GUIDE.md` - Complete setup instructions
- `PHASE_1A_CHECKLIST.md` - This file (action items)

✅ **Files Created**:

- `scripts/verifyInventoryTables.js` - Table verification script
- `scripts/buildInventoryIndex.js` - Index builder (TO BE CREATED)

---

## YOUR ACTION ITEMS (Do These Now)

### Step 1: Prepare Excel File (15-20 minutes)

**1.1 Make Backups**

```
1. Open Genthrust_Inventory.xlsx
2. Save As → Genthrust_Inventory_BACKUP_2025-11-13.xlsx (to Desktop)
3. Save As → Genthrust_Inventory_TEST.xlsx (working copy)
4. Close original, work only on TEST copy
```

**1.2 Convert 10 Sheets to Tables**

For each of these sheets:

- Bins Inventory → `BinsInventoryTable`
- Stock Room → `StockRoomInventoryTable`
- MD82 Parts → `MD82PartsTable`
- 727 Parts → `727PartsTable`
- TERRA → `TERRAInventoryTable`
- BER\_\_RAI → `BER_RAI_Table`
- ASIA AR PARTS → `ASIS_AR_PARTS_Table`
- ASIA AR SANFORD PARTS → `PARTES_AR_ASIA_SANFORD_Table`
- BOLIVIA PARTS → `BOLIVIA_PART_TABLE`
- DELTA APA → `DELTA_APA_TABLE`
- APA SANFORD AR 757 → `APA_SANFORD_757_TABLE`

**Quick Steps** (repeat 10 times):

1. Click sheet tab
2. Click any cell in data
3. Press **Ctrl+T**
4. ✅ Check "My table has headers"
5. Click OK
6. Table Design → Table Name → Enter name from list above
7. Save (Ctrl+S)

**Verify**: Press Ctrl+F3 (Name Manager), should see all 10 table names

**1.3 Create Index Table**

```
1. Insert new sheet named "InventoryIndex"
2. Row 1, paste these headers:
   IndexId | PartNumber | TableName | RowId | SerialNumber | Qty | Condition | Location | Description | LastSeen | ETag | ExtraMeta
3. Select A1:L1 → Ctrl+T → Check "headers" → OK
4. Table Design → Name: InventoryIndexTable
5. Save
```

**1.4 Create Transactions Table**

```
1. Insert new sheet named "Transactions"
2. Row 1, paste these headers:
   TxnId | Timestamp | Action | PartNumber | DeltaQty | NewQty | TableName | RowId | RONumber | User | Note
3. Select A1:K1 → Ctrl+T → Check "headers" → OK
4. Table Design → Name: InventoryTransactionsTable
5. Save
```

---

### Step 2: Upload to SharePoint (5 minutes)

**2.1 Upload Test File**

```
1. Go to SharePoint site
2. Navigate to: Documents/GenThrust/Inventory/ (or your folder)
3. Upload: Genthrust_Inventory_TEST.xlsx
4. Wait for upload to complete
```

**2.2 Get File ID**

```
1. Right-click uploaded file → Share → Copy link
2. URL looks like:
   https://yourcompany.sharepoint.com/:x:/r/.../Genthrust_Inventory_TEST.xlsx?d=ABC123DEF456&...
3. Copy the ID after "d=" (before the "&")
   Example: ABC123DEF456
```

**2.3 Add to Environment**

```
1. Open: repair-dashboard/.env.local
2. Add this line:
   VITE_INVENTORY_WORKBOOK_ID=ABC123DEF456
   (replace ABC123DEF456 with your actual file ID)
3. Save file
```

---

### Step 3: Verify Setup (2 minutes)

**Run Verification Script**:

```bash
cd repair-dashboard
npm run verify-inventory
```

**Expected**:

- Device code authentication prompt (sign in)
- Lists all 12 tables (10 inventory + index + transactions)
- Shows ✅ for all tables
- Displays column structure for each table

**If errors**: See INVENTORY_SETUP_GUIDE.md troubleshooting section

---

### Step 4: STOP HERE ✋

**DO NOT PROCEED** until you tell me:

1. ✅ All 12 tables created successfully
2. ✅ Uploaded to SharePoint
3. ✅ Verification script passes
4. ✅ File ID added to .env.local

**Then I will**:

1. Create `buildInventoryIndex.js` script
2. You'll run it to populate the index
3. We'll implement the search service
4. We'll add the UI components

---

## Quick Reference

### Table Names Cheat Sheet

```javascript
BinsInventoryTable              // Bins Inventory sheet
StockRoomInventoryTable         // Stock Room sheet
MD82PartsTable                  // MD82 Parts sheet
727PartsTable                   // 727 Parts sheet
TERRAInventoryTable             // TERRA sheet
BER_RAI_Table                   // BER/RAI sheet
PARTES_AR_ASIA_Table           // PARTES AR ASIA sheet
PARTES_AR_ASIA_SANFORD_Table   // PARTES AR ASIA SANFORD sheet
PARTES_BOLIVIA_Table           // PARTES BOLIVIA sheet
DELTA_APA_Table                // DELTA APA sheet
InventoryIndexTable            // NEW - InventoryIndex sheet
InventoryTransactionsTable     // NEW - Transactions sheet
```

### Environment Variables Needed

```env
# Already have these:
VITE_CLIENT_ID=...
VITE_TENANT_ID=...
VITE_SHAREPOINT_SITE_URL=...

# ADD THIS:
VITE_INVENTORY_WORKBOOK_ID=<file-id-from-sharepoint>
```

---

## Time Estimate

- ⏱️ Step 1 (Excel Tables): **15-20 minutes**
- ⏱️ Step 2 (Upload): **5 minutes**
- ⏱️ Step 3 (Verify): **2 minutes**

**Total**: ~25 minutes to complete Phase 1A setup

---

## Need Help?

**Problems with Excel tables?**
→ See `INVENTORY_SETUP_GUIDE.md` - detailed conversion steps with screenshots

**Verification script fails?**
→ Check table names match exactly (case-sensitive!)
→ Ensure all tables have headers checked

**Can't find file ID?**
→ SharePoint: Right-click file → Share → Look for `?d=` in URL

**Authentication issues?**
→ Make sure .env.local has correct CLIENT_ID and TENANT_ID
→ Azure AD app needs Files.ReadWrite.All permission

---

## What's Next (After You Complete Steps 1-3)

Once you've:

1. ✅ Created all 12 tables
2. ✅ Uploaded to SharePoint
3. ✅ Verified with script
4. ✅ Added file ID to .env.local

**Let me know** and I'll:

1. Create the index builder script
2. Guide you through running it
3. Implement inventory search service
4. Add React components
5. Test search functionality

**Then Phase 1A is COMPLETE** and we move to Phase 1B (RO integration)! 🚀
