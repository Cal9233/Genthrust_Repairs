# Claude Code Task List for RO Tracker Enhancements

## **Context Package for Claude Code**

"I have a React + TypeScript repair order tracking app that uses Microsoft Graph API to read/write to a SharePoint Excel file. The app authenticates with Azure AD (MSAL), displays repair orders in a table with dashboard stats, and allows creating new ROs and updating statuses.

Current stack: React 18, TypeScript, Vite, Tailwind CSS v3.4.1, shadcn/ui, TanStack Query (React Query), Microsoft Graph API, MSAL for auth.

Key files:

- `src/lib/excelService.ts` - handles all Excel/SharePoint operations
- `src/hooks/useROs.ts` - React Query hooks for data fetching
- `src/types/index.ts` - TypeScript types including RepairOrder interface
- `src/components/ROTable.tsx` - main table view
- `src/components/Dashboard.tsx` - statistics dashboard
- `src/components/RODetailDialog.tsx` - RO details modal
- `src/components/UpdateStatusDialog.tsx` - status update modal
- `src/components/AddRODialog.tsx` - create new RO modal

Current RepairOrder type has 22 fields including: roNumber, dateMade, shopName, partNumber, serialNumber, partDescription, requiredWork, dateDroppedOff, estimatedCost, finalCost, terms, shopReferenceNumber, estimatedDeliveryDate, currentStatus, currentStatusDate, genThrustStatus, shopStatus, trackingNumber, notes, lastDateUpdated, nextDateToUpdate, checked, isOverdue, daysOverdue."

---

## **TASK 1: Add Smart Auto-Calculation System**

```
TASK: Implement automatic "Next Date to Update" calculation based on status

REQUIREMENTS:
1. Create a new utility file `src/lib/businessRules.ts` with:
   - Function `calculateNextUpdateDate(status: string, statusDate: Date): Date` that returns:
     * "TO SEND" → statusDate + 3 days
     * "WAITING QUOTE" → statusDate + 14 days
     * "APPROVED" → statusDate + 7 days
     * "BEING REPAIRED" → statusDate + 10 days
     * "SHIPPING" → statusDate + 3 days
     * "PAID" → null (no follow-up needed)
   - Function `calculateDaysInStatus(statusDate: Date): number`
   - Function `getStatusColor(status: string, isOverdue: boolean): string` for consistent color coding

2. Update `src/lib/excelService.ts`:
   - In `addRepairOrder()`: Auto-calculate nextDateToUpdate based on initial status
   - In `updateRepairOrderStatus()`: When status changes, auto-update nextDateToUpdate field

3. Update `src/components/UpdateStatusDialog.tsx`:
   - Remove manual "Next Update Date" input field
   - Show calculated next update date as read-only info: "Next follow-up will be automatically set to [date]"
   - Add toggle: "Custom date" if user wants to override

4. Add to Dashboard statistics:
   - "Due Today" count (nextDateToUpdate = today)
   - "Overdue 30+ Days" count (daysOverdue > 30)
   - "On Track" count (nextDateToUpdate > today + 3 days)

EXISTING CODE TO MODIFY:
- excelService.ts already has updateRepairOrderStatus() method - enhance it
- Dashboard.tsx uses useDashboardStats() hook - add new stat calculations there
- Column 20 in Excel is "Next Date to Update" (index 19 in code)

OUTPUT: Working auto-calculation that reduces manual date entry
```

---

## **TASK 2: Create Shop Directory Management System**

````
TASK: Build a separate shop lookup table system to eliminate repetitive data entry

REQUIREMENTS:
1. Create new SharePoint Excel table structure:
   - File: Same SharePoint site, create "ShopDirectory.xlsx"
   - Table name: "ShopTable"
   - Columns: Shop Name, Contact Name, Email, Phone, Default Terms, Typical TAT (days), Notes, Active (Yes/No)

2. Create new service file `src/lib/shopService.ts`:
   - `getShops()` - fetch all active shops
   - `addShop(shopData)` - add new shop
   - `updateShop(shopId, shopData)` - update shop info
   - Follow same pattern as excelService.ts (use Graph API, MSAL, sessions)

3. Create new TypeScript type in `src/types/index.ts`:
   ```typescript
   interface Shop {
     id: string;
     shopName: string;
     contactName: string;
     email: string;
     phone: string;
     defaultTerms: string; // "COD", "NET 30", etc.
     typicalTAT: number; // days
     notes: string;
     active: boolean;
   }
````

4. Create new React Query hooks in `src/hooks/useShops.ts`:

   - `useShops()` - fetch shops
   - `useAddShop()` - mutation for adding
   - `useUpdateShop()` - mutation for updating

5. Update `src/components/AddRODialog.tsx`:

   - Replace text input "Shop Name" with searchable dropdown (use shadcn/ui Combobox)
   - When shop selected, auto-populate:
     - Terms field
     - Show contact info in a tooltip/hint
   - Add "+ Add New Shop" button that opens ShopManagementDialog

6. Create new component `src/components/ShopManagementDialog.tsx`:

   - Modal with form to add/edit shops
   - Fields: all Shop properties
   - Validation: shop name required, email format validation

7. Create new component `src/components/ShopDirectory.tsx`:
   - Accessible from main app navigation (add tab/button)
   - Table showing all shops with edit/deactivate actions
   - Search and filter capabilities
   - Shows: average TAT performance (calculated from historical ROs)

INTEGRATION NOTES:

- Shop dropdown should use Combobox from shadcn/ui (you may need to add this component)
- Use Zod for form validation (already used in project)
- Maintain same authentication pattern (MSAL instance passed to shopService)

OUTPUT: Full shop management system that eliminates typing shop names, terms, contacts repeatedly

```

---

## **TASK 3: Implement Status History Timeline**

```

TASK: Add status change logging with visual timeline instead of overwriting status

REQUIREMENTS:

1. Modify RepairOrder type in `src/types/index.ts`:

   - Add new field: `statusHistory: StatusHistoryEntry[]`
   - Define new type:

   ```typescript
   interface StatusHistoryEntry {
     status: string;
     date: Date;
     user: string; // from Azure AD auth
     cost?: number; // if quote received
     notes?: string;
     deliveryDate?: Date; // if approved
   }
   ```

2. Update `src/lib/excelService.ts`:

   - Store statusHistory as JSON string in "Notes" column (column 18)
   - When reading: parse JSON from Notes, extract statusHistory
   - When updating status: append new entry to statusHistory array, re-stringify to Notes
   - Keep last 20 entries (trim older ones to avoid data bloat)
   - Parse logic:
     ```typescript
     // Notes format: "HISTORY:[json]|NOTES:user notes here"
     // This keeps history separate from user-entered notes
     ```

3. Get current user from MSAL:

   - In excelService, accept msalInstance in methods
   - Extract user email/name: `msalInstance.getActiveAccount()?.name`

4. Create new component `src/components/StatusTimeline.tsx`:

   - Visual timeline showing status progression (use Lucide icons for status types)
   - Each entry shows: date, status, who changed it, any associated data (cost, notes)
   - Design: vertical timeline with connecting lines (similar to GitHub commit history)
   - Use Tailwind for styling (gray line connecting dots, colored status badges)

5. Update `src/components/RODetailDialog.tsx`:

   - Add new section "Status History"
   - Render StatusTimeline component
   - Place below current details, above action buttons

6. Update `src/components/UpdateStatusDialog.tsx`:
   - When status changes, create new StatusHistoryEntry
   - Capture current user automatically (no manual input)
   - Show previous status → new status with arrow visual

TECHNICAL NOTES:

- JSON in Excel Notes column format: Keep backward compatible with existing notes
- Use `JSON.parse()` with try-catch (handle malformed data gracefully)
- StatusTimeline should handle empty arrays (new ROs without history)

OUTPUT: Full audit trail of status changes with visual timeline in RO details

```

---

## **TASK 4: Build Email Composer Integration**

```

TASK: Add email generation capabilities directly in the app for common communication workflows

REQUIREMENTS:

1. Create new utility file `src/lib/emailTemplates.ts`:

   - Function `generateQuoteRequestEmail(ro: RepairOrder, shop: Shop): EmailContent`
   - Function `generateFollowUpEmail(ro: RepairOrder, shop: Shop): EmailContent`
   - Function `generateApprovalEmail(ro: RepairOrder, shop: Shop): EmailContent`
   - Define type:

   ```typescript
   interface EmailContent {
     to: string;
     subject: string;
     body: string; // formatted as plain text
   }
   ```

   - Templates should include:
     - Professional formatting
     - RO number, part details, serial numbers
     - Your company name/contact info
     - Placeholders for shop-specific info

2. Create new component `src/components/EmailComposerDialog.tsx`:

   - Props: repairOrder, shop (from shop lookup), onClose
   - Template selector dropdown: "Request Status Update", "Approve Repair", "Expedite Request", "Custom"
   - Editable textarea for email body (pre-filled from template)
   - Editable subject line
   - Buttons: "Copy to Clipboard", "Open in Outlook" (mailto: link), "Send via Graph API" (advanced)
   - Show preview in formatted style
   - Add checkbox: "Log this email in RO notes" (appends to statusHistory)

3. Update `src/components/RODetailDialog.tsx`:

   - Add "Send Email" button next to "Update Status"
   - Opens EmailComposerDialog
   - Fetch shop details from ShopDirectory (use shop name lookup)
   - If shop email not found, show warning: "No email on file for this shop"

4. Update `src/components/ROTable.tsx`:

   - Add email icon button in each row (Lucide Mail icon)
   - Quick action: opens EmailComposerDialog for that RO

5. Email sending options (implement simplest first):

   - **Option A (Easy)**: mailto: link - opens user's default email client with pre-filled content
   - **Option B (Advanced)**: Use Microsoft Graph API to send email directly
     - Requires Graph permission: Mail.Send
     - Endpoint: POST /me/sendMail
     - Add to excelService or create new emailService.ts

6. Email logging:
   - When "Log this email" checked, append to statusHistory:
     ```typescript
     {
       status: ro.currentStatus, // keep same status
       date: new Date(),
       user: currentUser,
       notes: `Email sent: ${emailSubject}`,
       emailType: templateName
     }
     ```

UI/UX NOTES:

- Use shadcn/ui Dialog component for modal
- Textarea should be tall (min 300px) for email body
- Add syntax highlighting or basic formatting toolbar (bold, lists) if time permits
- Copy to clipboard should show toast notification: "Email copied!"

OUTPUT: In-app email generation that eliminates context switching to Outlook

```

---

## **TASK 5: Add Bulk Operations & Smart Filters**

```

TASK: Enable multi-select actions and intelligent filtering for high-volume workflows

REQUIREMENTS:

1. Update `src/components/ROTable.tsx`:

   - Add checkbox column (first column)
   - Use state to track selected RO numbers: `const [selectedROs, setSelectedROs] = useState<string[]>([])`
   - "Select All" checkbox in header (with indeterminate state if partial selection)
   - Show action bar when items selected: "X items selected"

2. Create new component `src/components/BulkActionsBar.tsx`:

   - Sticky bar at bottom of screen (fixed position) when items selected
   - Actions:
     - "Mark as Sent" - batch update status to "TO SEND" + set date dropped off to today
     - "Request Updates" - open EmailComposerDialog with multi-RO template
     - "Export Selected" - generate CSV of selected ROs
     - "Clear Selection" button
   - Show count: "5 items selected"
   - Use shadcn/ui Button variants (destructive for clear, default for actions)

3. Add Smart Filter Buttons to Dashboard:

   - Create filter preset buttons above ROTable:
     - "🔴 Overdue" - filter where daysOverdue > 0
     - "⏰ Due This Week" - nextDateToUpdate within 7 days
     - "💰 High Value" - estimatedCost > $5000 or finalCost > $5000
     - "🏭 By Shop" - dropdown to filter specific shop
     - "📋 Waiting My Action" - status = "WAITING QUOTE" (quotes needing approval)
   - Active filter shows with badge/highlight
   - "Clear Filters" button
   - Filters should stack (can apply multiple)

4. Update `src/hooks/useROs.ts`:

   - Add `useBulkUpdateStatus()` mutation:
     ```typescript
     const useBulkUpdateStatus = () => {
       return useMutation({
         mutationFn: async ({
           roNumbers,
           newStatus,
         }: {
           roNumbers: string[];
           newStatus: string;
         }) => {
           // Loop through and update each RO
           // Use workbook session for batch operations
         },
       });
     };
     ```
   - Optimize: Use single workbook session for all updates

5. Export functionality:

   - Create `src/lib/exportUtils.ts`:
   - Function `exportToCSV(ros: RepairOrder[]): void`
   - Generate CSV with all fields
   - Trigger browser download
   - Use `Blob` and `URL.createObjectURL()` pattern

6. Add filter state management:

   - Create `src/hooks/useROFilters.ts`:

   ```typescript
   interface Filters {
     overdue: boolean;
     dueThisWeek: boolean;
     highValue: boolean;
     shop: string | null;
     waitingAction: boolean;
   }
   const useROFilters = (ros: RepairOrder[]) => {
     const [filters, setFilters] = useState<Filters>({...})
     const filteredROs = useMemo(() => {
       // Apply all active filters
     }, [ros, filters])
     return { filteredROs, filters, setFilters }
   }
   ```

7. Update ROTable to use filtered data:
   - Pass filteredROs from useROFilters hook
   - Show filter badges above table: "Showing 12 of 98 ROs"
   - Update search to work with filters (AND logic)

PERFORMANCE NOTES:

- For bulk operations >20 items, show progress indicator
- Use React.memo for table rows to prevent re-renders during selection
- Debounce filter changes (300ms) if filtering large datasets

OUTPUT: Efficient bulk operations and smart filtering that saves time on repetitive tasks

```

---

## **TASK 6: Data Cleanup & Migration Script**

```

TASK: Clean up existing Excel data to standardize formats before implementing new features

REQUIREMENTS:

1. Create new utility `src/scripts/dataCleanup.ts`:

   - Function `cleanupStatuses()`:

     - Remove ">>>>" from all status values
     - Trim whitespace
     - Standardize to exact values: "TO SEND", "WAITING QUOTE", "APPROVED", "BEING REPAIRED", "SHIPPING", "PAID"

   - Function `fixDateColumns()`:

     - Scan all date columns
     - Find invalid dates (like "1/13/1900")
     - Set to null or today's date based on context

   - Function `standardizeCurrency()`:

     - Remove quotes from currency values
     - Ensure consistent "$X,XXX.XX" format
     - Parse and validate numeric values

   - Function `migrateToStatusHistory()`:
     - For existing ROs, create initial statusHistory entry with current status
     - Preserve existing notes separately

2. Create CLI script for one-time execution:

   - Can be run from command line: `npm run cleanup-data`
   - Shows preview: "Will update 98 records, proceed? (y/n)"
   - Creates backup before changes: "Backup created: backup_2025-11-06.json"
   - Progress bar for bulk updates
   - Summary report at end

3. Add backup/restore functions in `src/lib/excelService.ts`:
   - `backupToJSON()`: Export all RO data to JSON file
   - `restoreFromJSON()`: Restore from backup if needed

SAFETY FEATURES:

- Dry-run mode: show what would change without modifying
- Rollback capability
- Detailed logging of all changes
- Validation checks before writes

EXECUTION:

- This should be run ONCE before deploying new features
- Document the cleanup process in README
- Provide before/after statistics

OUTPUT: Clean, standardized data that works reliably with new features

```

---

## **Priority Order Recommendation**

**Start with these in order:**
1. Task 6 (Data Cleanup) - Foundation, run once
2. Task 1 (Auto-Calculations) - Immediate time savings
3. Task 2 (Shop Directory) - Big quality of life improvement
4. Task 3 (Status History) - Better tracking
5. Task 4 (Email Composer) - Communication efficiency
6. Task 5 (Bulk Operations) - Power user features

---

## **How to Use with Claude Code**

Paste each task individually into Claude Code with this header:

```

I'm working on the GenThrust RO Tracker project. Here's the context:
[paste Context Package from top]

Now implement this specific task:
[paste one TASK block]

Existing files to reference/modify are in the project directory. Follow the existing code patterns (React Query, TypeScript strict mode, Tailwind v3 classes only, shadcn/ui components).

```

Would you like me to refine any of these tasks or add more specific implementation details?
```
