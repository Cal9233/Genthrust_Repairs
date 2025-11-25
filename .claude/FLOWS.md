# workflows.md - Key Workflows & Processes

## Purpose
This document describes the end-to-end workflows and processes in the GenThrust RO Tracker, from user actions to system responses.

---

## Core User Workflows

### 1. Create New Repair Order

**User Story:** As a user, I want to create a new RO when I send a part to a shop for repair.

**Steps:**
1. User clicks "Add RO" button on Dashboard
2. AddRODialog opens
3. User fills in required fields:
   - RO Number (auto-generated or manual)
   - Shop Name (dropdown or type to search)
   - Part Description
   - Required Work
4. User optionally fills:
   - Part Number, Serial Number
   - Dates (Made, Dropped Off, Est. Delivery)
   - Estimated Cost
   - Payment Terms
   - Initial Status
   - Notes
5. User clicks "Create RO"
6. System validates:
   - RO Number not duplicate
   - Required fields filled
7. System calls `useAddRepairOrder` mutation
8. Mutation creates RO via `excelService.addRepairOrder()`
9. Excel session created
10. New row added to RepairTable
11. Excel session closed
12. React Query invalidates cache
13. Dashboard auto-refreshes
14. Success toast shown
15. Dialog closes
16. New RO appears in table

**Error Paths:**
- Validation fails → Show error messages on fields
- Duplicate RO number → Show error: "RO already exists"
- Network error → Show error toast, keep dialog open
- Excel error → Show error toast, suggest retry

**File References:**
- UI: `AddRODialog.tsx`
- Hook: `useROs.ts` (useAddRepairOrder)
- Service: `excelService.ts` (addRepairOrder)
- Business Logic: `businessRules.ts` (calculateNextUpdateDate)

---

### 2. Update RO Status

**User Story:** As a user, I want to update the status of an RO when I receive information from the shop.

**Steps:**
1. User clicks on RO row in table
2. RODetailDialog opens
3. User clicks "Update Status" button
4. UpdateStatusDialog opens
5. User selects new status from dropdown
6. User optionally adds:
   - Notes
   - Cost (if quote received)
   - Delivery Date (if approved)
7. User clicks "Update Status"
8. System checks if archival needed:
   - Status = RECEIVED → Check payment terms
     - NET terms detected → Offer "Archive to NET sheet?"
     - Other terms → Offer "Archive to PAID sheet?"
     - Unclear terms → Show ArchiveDestinationDialog
   - Status = PAID/PAYMENT SENT → Offer "Archive to PAID?"
   - Status = BER/RAI/SCRAPPED → Offer "Archive to Returns?"
9. If user confirms archival:
   - Move RO to appropriate sheet (via moveROToArchive)
   - Create reminder if needed (NET payment)
10. If user declines archival or not needed:
    - Update status in active sheet
11. System calculates nextDateToUpdate (businessRules)
12. System appends to statusHistory
13. System updates Excel row
14. React Query invalidates cache
15. UI refreshes
16. Success toast shown
17. Dialogs close

**Business Logic Applied:**
- Next update date calculation (bll.md)
- Archive destination determination (bll.md)
- Payment term extraction (bll.md)
- Status history append

**File References:**
- UI: `UpdateStatusDialog.tsx`, `ArchiveDestinationDialog.tsx`
- Hook: `useROs.ts` (useUpdateROStatus, useArchiveRO)
- Service: `excelService.ts` (updateROStatus, moveROToArchive)
- Business Logic: `businessRules.ts`

---

### 3. Search Inventory for Part

**User Story:** As a user, I want to search the inventory database to find a part before creating an RO.

**Steps:**
1. User clicks "Inventory" tab
2. InventorySearchTab loads
3. User types part number in search box (debounced 300ms)
4. After debounce, `useInventorySearch` hook triggers
5. Frontend calls backend API: `GET /api/inventory/search?partNumber=XXX`
6. Backend performs 3-tier search:
   - Tier 1: Exact match in inventoryindex
   - Tier 2: LIKE search in inventoryindex
   - Tier 3: Direct search in stock_room, bins_inventory
7. Backend returns JSON array of InventoryItem[]
8. Frontend displays results in table
9. User sees:
   - Part Number
   - Serial Number
   - Qty
   - Condition
   - Location
   - Description
   - Table Name
10. User can click "Create RO from Part" (planned feature)

**Performance Optimizations:**
- Debounced input (300ms delay)
- Backend limits results (50 max)
- Indexed database queries
- React Query caching

**File References:**
- UI: `InventorySearchTab.tsx`
- Hook: `useInventorySearch.ts`
- Service: `inventoryService.ts` (frontend)
- Backend Route: `backend/routes/inventory.js`
- Database: `genthrust_inventory.inventoryindex`

---

### 4. Send Email to Shop

**User Story:** As a user, I want to email a shop to request a status update.

**Steps:**
1. User opens RODetailDialog for an RO
2. User clicks "Email Shop" button
3. EmailComposerDialog opens
4. System pre-fills:
   - To: shop.email
   - Subject: Based on template (e.g., "Status Update Request - RO 12345")
   - Body: Template with RO details
5. User can edit subject and body
6. User clicks "Send Email"
7. System calls Microsoft Graph API:
   - POST /me/sendMail
8. Email sent via Outlook
9. System logs email (planned feature)
10. Success toast shown
11. Dialog closes

**Email Templates:**
- Quote Request
- Status Update Request
- Approval Confirmation
- Custom

**File References:**
- UI: `EmailComposerDialog.tsx`
- Service: `emailTemplates.ts` (template generation)
- API: Microsoft Graph (sendMail endpoint)

---

### 5. Upload File Attachment

**User Story:** As a user, I want to upload a quote PDF or photo to an RO for reference.

**Steps:**
1. User opens RODetailDialog
2. User clicks "Attachments" tab
3. AttachmentManager component loads
4. User drags file onto drop zone OR clicks "Upload"
5. File picker opens (if clicked)
6. User selects file(s)
7. System calls `useUploadAttachment` mutation
8. Mutation calls `sharePointService.uploadFile(roNumber, file)`
9. Service creates folder if not exists: `RO Attachments/RO-12345/`
10. Service uploads file via Graph API:
    - PUT /me/drive/root:/{folderPath}/{fileName}:/content
11. File uploaded to SharePoint/OneDrive
12. Service returns Attachment object
13. React Query invalidates attachments cache
14. AttachmentManager refreshes
15. New file appears in list
16. Success toast shown

**File Operations:**
- Upload (single or multiple)
- Download (downloads file as blob)
- Delete (with confirmation)
- View metadata (created by, date, size)

**File References:**
- UI: `AttachmentManager.tsx`
- Hook: `useAttachments.ts`
- Service: `sharePointService.ts`
- API: Microsoft Graph (OneDrive/SharePoint endpoints)

---

### 6. Use AI Assistant to Update RO

**User Story:** As a user, I want to update an RO using natural language instead of clicking through forms.

**Steps:**
1. User presses Ctrl+K (or clicks "AI Assistant")
2. AIAgentDialog opens
3. User types: "Update RO 12345 to RECEIVED status"
4. User presses Enter
5. Message sent to AI agent
6. System calls `anthropicAgent.processCommand(message, context)`
7. Context prepared:
   - All active ROs
   - All shops
   - Current user
8. API call to Anthropic with streaming:
   - POST /v1/messages (Anthropic API)
   - With tools: update_repair_order, query_repair_orders, etc.
9. AI analyzes command
10. AI decides to use `update_repair_order` tool
11. AI returns tool_use block:
    ```json
    {
      "name": "update_repair_order",
      "input": {
        "roNumber": "12345",
        "updates": { "status": "RECEIVED" }
      }
    }
    ```
12. System executes tool (aiTools.ts)
13. Tool calls `excelService.updateROStatus(...)`
14. RO updated in Excel
15. Tool returns success result to AI
16. AI generates final response: "✓ Successfully updated RO 12345 to RECEIVED."
17. Response streamed to UI in real-time
18. System logs interaction (loggingService)
19. React Query invalidates cache
20. Dashboard auto-refreshes
21. Success toast shown

**AI Tools Available:**
1. `update_repair_order` - Update any RO field
2. `query_repair_orders` - Search/filter ROs
3. `send_reminder_email` - Email shops
4. `get_repair_order_summary` - Get RO details
5. `archive_repair_order` - Archive RO

**File References:**
- UI: `AIAgentDialog.tsx`
- Service: `anthropicAgent.ts`, `aiTools.ts`
- API: Anthropic Claude Sonnet 4
- Logging: `loggingService.ts`

---

### 7. Archive Repair Order

**User Story:** As a user, I want to move a completed RO to the archive to keep the active list clean.

**Steps:**
1. User updates RO status to RECEIVED (or PAID, BER, etc.)
2. System detects archival eligibility
3. System determines destination:
   - RECEIVED + NET terms → NET sheet
   - RECEIVED + other terms → PAID sheet
   - PAID/PAYMENT SENT → PAID sheet
   - BER/RAI → Returns sheet
4. System shows confirmation dialog:
   - "Move RO 12345 to PAID sheet?"
5. User clicks "Confirm"
6. System calls `useArchiveRO` mutation
7. Mutation calls `excelService.moveROToArchive(rowIndex, targetSheet, targetTable)`
8. Excel session created
9. Row data read from active sheet
10. Row deleted from active sheet
11. Row added to target sheet
12. If NET sheet → Create payment reminder (Calendar event)
13. Excel session closed
14. React Query invalidates both caches (active & archive)
15. UI refreshes
16. Success toast shown
17. RO disappears from active list

**Archive Sheets:**
- **PAID** - Completed & paid ROs
- **NET** - Received, awaiting NET payment
- **Returns** - BER, RAI, Cancelled

**File References:**
- Service: `excelService.ts` (moveROToArchive)
- Hook: `useROs.ts` (useArchiveRO)
- Business Logic: `businessRules.ts` (determineArchiveDestination)
- Reminder: `reminderService.ts` (createPaymentDueCalendarEvent)

---

### 8. Create Reminder for RO Follow-Up

**User Story:** As a user, I want an automatic reminder to follow up on an RO so I don't forget.

**Steps:**
1. User updates RO status
2. System calculates nextDateToUpdate (businessRules)
3. System offers: "Create reminder for [date]?"
4. User selects reminder type:
   - Microsoft To Do task
   - Outlook Calendar event
   - Both
5. User clicks "Create Reminder"
6. System calls `reminderService.createToDoTask()` or `.createCalendarEvent()`
7. Service calls Microsoft Graph API:
   - To Do: POST /me/todo/lists/{listId}/tasks
   - Calendar: POST /me/calendar/events
8. Reminder created in Microsoft 365
9. Success toast shown
10. User will receive reminder on due date

**Reminder Types:**
- **To Do Task** - Appears in Microsoft To Do app
- **Calendar Event** - Appears in Outlook calendar with reminder notification
- **Both** - Creates both

**Special Case - NET Payment Reminder:**
- When RO archived to NET sheet
- Calendar event created for payment due date
- Calculated: receivedDate + NET days (e.g., + 30 days)
- Event title: "Payment Due: RO 12345 - Duncan Aviation ($5,000)"

**File References:**
- Service: `reminderService.ts`
- API: Microsoft Graph (To Do & Calendar)

---

### 9. View Shop Analytics

**User Story:** As an advanced user, I want to see performance metrics for each shop.

**Access:** Only for `cmalagon@genthrust.net`

**Steps:**
1. User clicks "Analytics" tab (visible only to advanced users)
2. ShopAnalyticsTab loads
3. User selects shop from dropdown
4. System calls `useShopAnalytics(shopName)` hook
5. Hook calculates metrics:
   - Total ROs with shop
   - Active vs completed
   - Average turnaround time
   - On-time delivery rate
   - Total spent
   - Average cost per RO
   - BER/RAI rates
   - Recent activity
6. Metrics displayed in cards/charts
7. User can compare shops
8. User can export data (planned)

**Metrics Calculated:**
- Volume (total ROs, active, completed)
- Performance (turnaround, on-time %)
- Financial (total spent, avg cost)
- Quality (BER rate, RAI rate, success rate)
- Activity (last RO date, recent count)

**File References:**
- UI: `ShopAnalyticsTab.tsx`
- Hook: `useAnalytics.ts`
- Business Logic: Analytics calculations

---

## System Workflows

### 10. Automatic Data Refresh

**Purpose:** Keep UI in sync with Excel data changes.

**Steps:**
1. React Query configured with:
   - staleTime: 5 minutes
   - refetchInterval: 1 minute
   - refetchOnWindowFocus: true
2. Every minute:
   - React Query checks if data is stale
   - If stale, refetch from Excel
3. On window focus:
   - React Query refetches immediately
4. On mutation success:
   - React Query invalidates cache
   - Immediate refetch
5. UI updates automatically

**Optimization:**
- Cache prevents unnecessary API calls
- Background refetch doesn't block UI
- Stale-while-revalidate pattern

---

### 11. Authentication Flow

**Purpose:** Secure access to Microsoft 365 data.

**Steps:**
1. User visits app
2. MSAL checks if authenticated
3. If not authenticated:
   - Show login screen
   - User clicks "Sign in with Microsoft"
   - MSAL initiates auth flow (popup or redirect)
   - User enters credentials at login.microsoftonline.com
   - MFA challenge if enabled
   - User approves permissions
   - Auth code returned to app
   - MSAL exchanges code for tokens:
     - Access Token (1 hour)
     - Refresh Token (90 days)
   - Tokens stored in sessionStorage
4. If authenticated:
   - Load app
   - Services initialized with MSAL instance
5. On API call:
   - Service calls `getAccessToken()`
   - MSAL tries silent acquisition (use cached/refreshed token)
   - If silent fails, try popup
   - If popup fails, use redirect
6. Token automatically refreshed before expiration

**Token Lifecycle:**
- Access Token: 1 hour (used for API calls)
- Refresh Token: 90 days (used to get new access tokens)
- Silent refresh happens automatically

**File References:**
- Config: `msalConfig.ts`
- Services: All services (excelService, shopService, etc.)
- Method: `getAccessToken()`

---

### 12. Error Recovery

**Purpose:** Gracefully handle errors and guide user to resolution.

**Common Errors:**

**401 Unauthorized (Token expired):**
1. Silent token refresh attempted
2. If fails, show login dialog
3. User re-authenticates
4. Original request retried

**403 Forbidden (Insufficient permissions):**
1. Show error: "Missing permissions"
2. Suggest: "Contact admin to grant permissions"
3. Link to Azure AD app settings

**404 Not Found (File/table missing):**
1. Show error: "Excel file not found"
2. Suggest: "Check file name in .env"
3. Link to setup docs

**429 Too Many Requests (Rate limit):**
1. Implement exponential backoff
2. Wait 5 seconds
3. Retry request
4. If still fails, show error

**500 Internal Server Error (SharePoint issue):**
1. Retry after 3 seconds
2. If fails, show error
3. Suggest: "Try again later"

**Network Error:**
1. Show error: "No internet connection"
2. Retry button
3. Auto-retry on connection restore

---

### 13. Logging & Audit Trail

**Purpose:** Track all AI interactions for review and compliance.

**Steps:**
1. User executes AI command
2. AI processes and executes tools
3. System calls `loggingService.logAIInteraction()`
4. Service creates log entry:
   ```typescript
   {
     timestamp: new Date(),
     action: 'update_repair_order',
     user: 'cmalagon@genthrust.net',
     details: 'Update RO 12345 to RECEIVED',
     result: 'Success',
     roNumber: '12345'
   }
   ```
5. Service gets or creates daily log file: `AI_Log_2025-01-17.xlsx`
6. Service appends entry to Excel file in SharePoint/OneDrive
7. Entry stored for review

**Log Review:**
1. User clicks "Logs" button
2. LogsDialog opens
3. User selects date
4. System fetches log file via `loggingService.getAILogs(date)`
5. Logs displayed in table
6. User can export to Excel

**File References:**
- Service: `loggingService.ts`
- UI: `LogsDialog.tsx`
- Storage: SharePoint/OneDrive `AI_Logs/` folder

---

### 14. Excel Session Management

**Purpose:** Prevent conflicts when multiple users edit simultaneously.

**Pattern:**
```typescript
await sessionManager.withSession(fileId, async (sessionId) => {
  // Read data
  const row = await getRow(rowIndex, sessionId);

  // Modify data
  row.values[13] = newStatus;

  // Write data
  await updateRow(rowIndex, row, sessionId);

  // Session automatically closed even if error occurs
});
```

**Benefits:**
- Isolated write context
- Prevents overwriting other users' changes
- Automatic cleanup (session closed in finally block)
- Microsoft recommended pattern

**File References:**
- Manager: `excelSession.ts`
- Usage: `excelService.ts` (all write operations)

---

## Integration Workflows

### 15. Bulk Operations

**Purpose:** Perform actions on multiple ROs at once.

**Steps:**
1. User selects multiple ROs (checkboxes)
2. BulkActionsBar appears at bottom
3. User clicks bulk action:
   - Bulk Status Update
   - Bulk Archive
   - Export to CSV
4. For Status Update:
   - UpdateStatusDialog opens
   - User selects new status
   - System updates all selected ROs sequentially
   - Progress indicator shown
   - Success toast per RO
5. For Archive:
   - Confirmation dialog
   - System archives all selected ROs
6. For Export:
   - System generates CSV
   - File downloads immediately

**File References:**
- UI: `BulkActionsBar.tsx`
- Hook: `useROs.ts` (useBulkUpdateStatus)
- Export: `exportUtils.ts`

---

### 16. Theme Toggle

**Purpose:** Allow users to switch between light and dark mode.

**Steps:**
1. User clicks theme toggle button (Sun/Moon icon)
2. `useTheme` hook called
3. Theme state toggled (light ↔ dark)
4. HTML element class updated: `class="dark"`
5. CSS variables recalculated
6. All components re-render with new theme
7. Preference saved to localStorage
8. On next visit, theme restored from localStorage

**File References:**
- Component: `ThemeToggle.tsx`
- Hook: `useTheme.ts`
- CSS: `index.css` (CSS variables)

---

## Planned Workflows (Future)

### 17. Global Search (Across All Sheets)

**Purpose:** Search active and archived ROs from one place.

**Planned Steps:**
1. User types in global search box
2. System searches:
   - Active ROs
   - PAID archive
   - NET archive
   - Returns archive
3. Results displayed in tabs
4. User can filter by sheet
5. Click result → Open detail dialog

---

### 18. Automated Status Progression

**Purpose:** Auto-update status based on tracking number delivery.

**Planned Steps:**
1. Background job runs daily
2. For ROs in "SHIPPING" status:
   - Fetch tracking status from carrier API
   - If delivered → Auto-update to "PAID"
   - Create notification
3. User reviews auto-updates

---

### 19. Predictive Delivery Dates

**Purpose:** Estimate delivery date based on historical data.

**Planned Steps:**
1. User creates RO with shop
2. System analyzes:
   - Historical turnaround times for this shop
   - Part type patterns
   - Current shop workload
3. System suggests estimated delivery date
4. User can accept or override

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code


### Search/Filter Repair Orders

**User Story:** As a user, I want to quickly find repair orders by searching across all key fields.

**Workflow:**
1. User navigates to Dashboard (ROTable visible)
2. User types search term in search box ("Search ROs, shops, parts...")
3. Search is applied in real-time (via React useMemo)
4. Table filters to show only matching ROs

**Search Algorithm:**
```typescript
// Client-side filtering (lines 130-143 in ROTable/index.tsx)
if (search) {
  filtered = filtered.filter((ro) =>
    String(ro.roNumber)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.shopName)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.partDescription)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.serialNumber)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.partNumber)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.shopReferenceNumber)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.trackingNumber)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.requiredWork)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.currentStatus)?.toLowerCase().includes(search.toLowerCase()) ||
    String(ro.notes)?.toLowerCase().includes(search.toLowerCase())
  );
}
```

**Performance:**
- Executes in < 10ms for 100 ROs
- Uses React useMemo to avoid re-filtering on every render
- Only re-filters when `search` term or `filterAppliedROs` changes

**Examples:**
- Search "Duncan" → Finds all ROs from Duncan Aviation
- Search "1Z999" → Finds ROs with tracking numbers starting with "1Z999"
- Search "APPROVED" → Finds ROs with status "APPROVED >>>>"
- Search "expedited" → Finds ROs with "expedited" in notes

**Data Source Independence:**
- Works identically for MySQL data (primary source)
- Works identically for Excel data (fallback source)
- Both sources map to same TypeScript interface (camelCase fields)

---

