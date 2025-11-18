# bll.md - Business Logic Layer Documentation

## Purpose
This document describes the business rules, logic, and calculations that govern the GenThrust RO Tracker application. This is the "brain" of the system - the rules that make it intelligent.

---

## Business Logic Location

**Primary File:** `repair-dashboard/src/lib/businessRules.ts`

**Other Logic Locations:**
- `excelService.ts` - RO state management
- `updateStatusDialog.tsx` - Status change validation
- `anthropicAgent.ts` - AI command interpretation
- `reminderService.ts` - Reminder scheduling logic

---

## Core Business Rules

### 1. Status-Based Next Update Date Calculation

**Purpose:** Automatically calculate when to follow up on an RO based on its current status.

**Implementation:** `calculateNextUpdateDate(status, statusDate, paymentTerms?): Date | null`

**Rules:**

| Status | Follow-Up Period | Rationale |
|--------|-----------------|-----------|
| TO SEND | 3 days | Confirm part was shipped to shop |
| WAITING QUOTE | 14 days | Allow time for shop to assess and quote |
| APPROVED | 7 days | Check if repair work has started |
| BEING REPAIRED | 10 days | Request progress update |
| CURRENTLY BEING SHIPPED | 5 days | Verify inbound delivery to shop |
| RECEIVED | 3 days | Process payment and finalize |
| SHIPPING | 3 days | Track outbound delivery to customer |
| PAID | Varies by payment terms | Schedule based on NET terms or mark complete |
| PAYMENT SENT | null | Order complete, no follow-up |
| BER | null | Beyond economic repair, no follow-up |
| RAI | null | Return as-is, no follow-up |
| SCRAPPED | null | Scrapped onsite, no follow-up |

**Special Case - PAID Status:**

```typescript
if (status === 'PAID' && paymentTerms) {
  const netDays = extractNetDays(paymentTerms);

  if (netDays) {
    // NET 30/60/90 - calculate payment due date
    return addDays(statusDate, netDays);
  } else if (paymentTerms.includes('COD') || paymentTerms.includes('Prepaid')) {
    // Already paid, no follow-up
    return null;
  } else if (paymentTerms.includes('Wire') || paymentTerms.includes('XFER')) {
    // Wire transfer processing time
    return addDays(statusDate, 3);
  } else {
    // Unknown terms, default to 30 days
    return addDays(statusDate, 30);
  }
}
```

**File Location:** `businessRules.ts:15-80`

---

### 2. Payment Term Detection

**Purpose:** Extract NET payment terms (NET 30, NET 60, NET 90) from freeform text.

**Implementation:** `extractNetDays(terms: string): number | null`

**Regex Pattern:**
```typescript
const netPattern = /NET\s*(\d+)/i;
```

**Examples:**
- "NET 30" → 30
- "net30" → 30
- "Net 60 days" → 60
- "NET90" → 90
- "COD" → null
- "Prepaid" → null

**Supported Terms:**
- **NET 30/60/90** - Pay within X days of invoice
- **COD** - Cash on delivery
- **Prepaid** - Payment before shipment
- **Credit Card** - Immediate payment
- **Wire Transfer / XFER** - Bank wire
- **Check** - Payment by check

**File Location:** `businessRules.ts:105-115`

---

### 3. Archive Destination Logic

**Purpose:** Determine which archive sheet to move a completed RO to.

**Implementation:** `determineArchiveDestination(status, paymentTerms): 'PAID' | 'NET' | 'Returns' | null`

**Decision Tree:**

```
Status = RECEIVED?
├─ Yes → Check payment terms
│   ├─ NET terms detected → 'NET' sheet
│   ├─ Other terms (COD, Prepaid, etc.) → 'PAID' sheet
│   └─ No terms / unclear → Prompt user (ArchiveDestinationDialog)
│
├─ Status = PAID or PAYMENT SENT?
│   └─ → 'PAID' sheet
│
├─ Status = BER or RAI or SCRAPPED?
│   └─ → 'Returns' sheet
│
└─ Other status?
    └─ → null (don't archive, keep in active sheet)
```

**Rationale:**
- **PAID Sheet:** Completed orders that have been paid
- **NET Sheet:** Received orders awaiting NET payment (need payment reminder)
- **Returns Sheet:** Orders that didn't result in a repair (BER, RAI, cancelled)

**File Location:** `businessRules.ts:120-145`

---

### 4. Overdue Calculation

**Purpose:** Determine if an RO is overdue for follow-up.

**Implementation:**
```typescript
const today = new Date();
const nextUpdate = ro.nextDateToUpdate;

if (nextUpdate) {
  const diffTime = today.getTime() - nextUpdate.getTime();
  const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = daysOverdue > 0;
}
```

**Display Logic:**
- If `nextDateToUpdate` is in the past → Mark as overdue
- Display days overdue: "5 days overdue"
- Highlight row in red
- Show warning icon

**File Location:** `excelService.ts:225-235`

---

### 5. Status Transition Validation

**Purpose:** Ensure status changes follow logical workflow.

**Valid Transition Paths:**

```
TO SEND
  └─> WAITING QUOTE
      └─> APPROVED
          └─> BEING REPAIRED
              └─> CURRENTLY BEING SHIPPED (to shop)
                  └─> RECEIVED (by GenThrust)
                      ├─> SHIPPING (to customer)
                      │   └─> PAID
                      │       └─> PAYMENT SENT
                      │
                      ├─> BER (beyond economic repair)
                      └─> RAI (return as-is)

Special cases:
- Can skip from APPROVED → CURRENTLY BEING SHIPPED (if shop already has part)
- Can skip from RECEIVED → PAYMENT SENT (if already paid)
- Can go to BER/RAI from any status after WAITING QUOTE
```

**Implementation:** (Currently not strictly enforced, but validation exists in UI)

```typescript
function validateStatusTransition(current: string, next: string): boolean {
  const validTransitions = {
    'TO SEND': ['WAITING QUOTE'],
    'WAITING QUOTE': ['APPROVED', 'BER', 'RAI'],
    'APPROVED': ['BEING REPAIRED', 'CURRENTLY BEING SHIPPED', 'BER'],
    'BEING REPAIRED': ['CURRENTLY BEING SHIPPED', 'SHIPPING', 'BER'],
    'CURRENTLY BEING SHIPPED': ['RECEIVED'],
    'RECEIVED': ['SHIPPING', 'PAID', 'PAYMENT SENT', 'BER', 'RAI'],
    'SHIPPING': ['PAID'],
    'PAID': ['PAYMENT SENT'],
  };

  return validTransitions[current]?.includes(next) || false;
}
```

**Note:** Validation is lenient to allow manual correction of mistakes.

---

### 6. Status History Management

**Purpose:** Track all status changes with timestamps, costs, and notes.

**Data Structure:**
```typescript
interface StatusHistoryEntry {
  status: string;
  date: Date;
  user: string;           // Azure AD user email
  cost?: number;          // If quote received or cost updated
  notes?: string;         // Optional notes
  deliveryDate?: Date;    // If delivery date changed
}
```

**Append Logic:**
```typescript
// When status changes:
const newEntry: StatusHistoryEntry = {
  status: newStatus,
  date: new Date(),
  user: currentUser.email,
  cost: updatedCost,
  notes: userNotes,
  deliveryDate: updatedDeliveryDate
};

// Append to existing history
ro.statusHistory = [...existingHistory, newEntry];
```

**Storage:** Stored as JSON string in Excel "Status History" column

**File Location:** `excelService.ts:updateROStatus()` method

---

### 7. Cost Tracking Rules

**Purpose:** Track estimated vs. final costs and calculate variance.

**Fields:**
- `estimatedCost` - Initial quote from shop
- `finalCost` - Actual final cost (may differ)

**Cost Update Rules:**
1. **WAITING QUOTE → APPROVED**
   - If cost provided → Set as `estimatedCost`
   - Append to status history

2. **RECEIVED**
   - If cost differs → Update `finalCost`
   - Calculate variance: `(finalCost - estimatedCost) / estimatedCost * 100`

3. **Dashboard Display:**
   - Total Estimated Value: Sum of all `estimatedCost`
   - Total Final Value: Sum of all `finalCost`
   - Variance: `(totalFinal - totalEstimated) / totalEstimated * 100%`

---

### 8. Reminder Automation

**Purpose:** Automatically schedule reminders when RO status changes.

**Trigger Points:**

1. **Status Change → To Do Task**
   ```typescript
   if (nextUpdateDate) {
     await reminderService.createToDoTask(
       `Follow up on RO ${roNumber}`,
       nextUpdateDate,
       `Status: ${status}\nShop: ${shopName}`
     );
   }
   ```

2. **RECEIVED + NET Terms → Calendar Event**
   ```typescript
   if (status === 'RECEIVED' && isNetPayment(paymentTerms)) {
     const netDays = extractNetDays(paymentTerms);
     await reminderService.createPaymentDueCalendarEvent(
       roNumber,
       shopName,
       finalCost,
       netDays
     );
   }
   ```

**File Location:** `reminderService.ts` + `excelService.ts` (updateROStatus)

---

### 9. Email Template Logic

**Purpose:** Generate contextual emails to shops based on RO status.

**Template Types:**

1. **Quote Request Email**
   ```
   Subject: Quote Request - RO ${roNumber}

   Dear ${shop.contact},

   We have sent you a part for repair:
   Part: ${ro.partDescription} (PN: ${ro.partNumber})
   SN: ${ro.serialNumber}
   Work Required: ${ro.requiredWork}

   Please provide a quote for the repair at your earliest convenience.

   Thank you,
   ${user.name}
   GenThrust XVII
   ```

2. **Status Update Request**
   ```
   Subject: Status Update Request - RO ${roNumber}

   Dear ${shop.contact},

   Could you please provide an update on the following repair order?
   RO #: ${roNumber}
   Part: ${ro.partDescription}
   Current Status: ${ro.currentStatus}
   Last Update: ${formatDate(ro.lastDateUpdated)}

   Thank you,
   ${user.name}
   ```

3. **Approval Notification**
   ```
   Subject: Repair Approved - RO ${roNumber}

   Dear ${shop.contact},

   We have approved the quote for RO ${roNumber}.
   Approved Amount: ${formatCurrency(ro.estimatedCost)}

   Please proceed with the repair.

   Thank you,
   ${user.name}
   ```

**File Location:** `emailTemplates.ts`

---

### 10. Dashboard Statistics Logic

**Purpose:** Calculate real-time dashboard KPIs.

**Calculated Metrics:**

```typescript
interface DashboardStats {
  // Active ROs
  totalActive: number              // ROs not in PAID/PAYMENT SENT/BER
  overdue: number                  // ROs past nextDateToUpdate
  waitingQuote: number             // Status = WAITING QUOTE
  approved: number                 // Status = APPROVED
  beingRepaired: number            // Status = BEING REPAIRED
  shipping: number                 // Status = SHIPPING or CURRENTLY BEING SHIPPED
  dueToday: number                 // nextDateToUpdate = today
  overdue30Plus: number            // Overdue by 30+ days
  onTrack: number                  // Not overdue

  // Financial
  totalValue: number               // Sum of all finalCost
  totalEstimatedValue: number      // Sum of all estimatedCost
  totalFinalValue: number          // Sum of all finalCost (completed ROs)

  // Archive Stats
  approvedPaid: number             // Count in PAID sheet
  approvedNet: number              // Count in NET sheet
  rai: number                      // Count in Returns sheet (RAI)
  ber: number                      // Count in Returns sheet (BER)
  cancel: number                   // Count in Returns sheet (Cancelled)
}
```

**Calculation Logic:**
```typescript
function calculateDashboardStats(ros: RepairOrder[]): DashboardStats {
  const activeROs = ros.filter(ro => !['PAID', 'PAYMENT SENT', 'BER'].includes(ro.currentStatus));

  return {
    totalActive: activeROs.length,
    overdue: activeROs.filter(ro => ro.isOverdue).length,
    waitingQuote: activeROs.filter(ro => ro.currentStatus === 'WAITING QUOTE').length,
    // ... etc
  };
}
```

**File Location:** `hooks/useROs.ts` (useDashboardStats)

---

### 11. Search & Filter Logic

**Purpose:** Client-side filtering and search across RO data.

**Search Fields:**
- RO Number
- Shop Name
- Part Number
- Serial Number
- Part Description

**Filter Options:**
1. **Overdue Only**
   ```typescript
   ros.filter(ro => ro.isOverdue)
   ```

2. **High Value (>$5000)**
   ```typescript
   ros.filter(ro => (ro.finalCost || ro.estimatedCost || 0) > 5000)
   ```

3. **Due This Week**
   ```typescript
   ros.filter(ro => {
     const nextUpdate = ro.nextDateToUpdate;
     return nextUpdate && isWithinInterval(nextUpdate, {
       start: startOfWeek(new Date()),
       end: endOfWeek(new Date())
     });
   })
   ```

4. **Filter by Shop**
   ```typescript
   ros.filter(ro => ro.shopName === selectedShop)
   ```

5. **Filter by Status**
   ```typescript
   ros.filter(ro => ro.currentStatus === selectedStatus)
   ```

**File Location:** `ROTable.tsx` + `hooks/useROFilters.ts`

---

### 12. Bulk Operation Rules

**Purpose:** Apply actions to multiple ROs at once.

**Supported Operations:**
1. **Bulk Status Update**
   - Select multiple ROs
   - Change all to same status
   - Append same note to all
   - Calculate next update date for each

2. **Bulk Archive**
   - Archive multiple ROs to same sheet
   - Validate all are eligible for archiving

3. **Bulk Export**
   - Export selected ROs to CSV
   - Include all fields

**Validation:**
- Ensure all selected ROs are in valid state for operation
- Warn if operation would result in data loss
- Confirm before executing

**File Location:** `BulkActionsBar.tsx` + `hooks/useROs.ts` (useBulkUpdateStatus)

---

### 13. AI Command Interpretation

**Purpose:** Convert natural language to structured actions.

**Example Commands:**

1. **Update Status**
   - "Update RO 12345 to RECEIVED"
   - "Change status of RO 12345 to being repaired"
   - Extracted: `{ action: 'update', roNumber: '12345', status: 'RECEIVED' }`

2. **Query ROs**
   - "Show me all overdue ROs from Duncan Aviation"
   - Extracted: `{ action: 'query', filters: { overdue: true, shop: 'Duncan Aviation' } }`

3. **Send Email**
   - "Send reminder to StandardAero for RO 12346"
   - Extracted: `{ action: 'email', roNumber: '12346', shop: 'StandardAero' }`

4. **Get Summary**
   - "What's the status of RO 12347?"
   - Extracted: `{ action: 'summary', roNumber: '12347' }`

**Implementation:** Claude's tool use API handles this automatically

**File Location:** `services/anthropicAgent.ts` + `services/aiTools.ts`

---

### 14. Shop Analytics Logic

**Purpose:** Calculate performance metrics for each shop.

**Metrics Calculated:**

```typescript
interface ShopAnalytics {
  shopName: string;

  // Volume
  totalROs: number;
  activeROs: number;
  completedROs: number;

  // Performance
  avgTurnaroundDays: number;        // Avg from TO SEND to RECEIVED
  onTimeDeliveryRate: number;       // % delivered by estimated date

  // Financial
  totalSpent: number;               // Sum of all finalCost
  avgCostPerRO: number;             // Average repair cost
  minCost: number;
  maxCost: number;

  // Quality
  berRate: number;                  // % of ROs that were BER
  raiRate: number;                  // % of ROs that were RAI
  successRate: number;              // % completed successfully

  // Recent Activity
  lastRODate: Date | null;          // Most recent RO
  recentROCount30Days: number;      // ROs in last 30 days
}
```

**File Location:** `hooks/useAnalytics.ts`

---

## Business Rule Configuration

### Editable Rules (via code)
- Status follow-up periods (businessRules.ts)
- Payment term patterns (businessRules.ts)
- Archive destination logic (businessRules.ts)
- Email templates (emailTemplates.ts)

### Hard-Coded Rules (in Excel)
- Column mappings (excelSheets.ts)
- Table names (excelSheets.ts)
- Required fields (validated in UI)

---

## Business Rule Testing

**Test Files:**
- `businessRules.test.ts` - Status calculation, payment terms, archival logic
- `emailTemplates.test.ts` - Email generation
- `excelSession.test.ts` - Session management
- `useROs.test.tsx` - Dashboard stats calculation

**Test Coverage:**
- All status → next update date mappings
- All payment term patterns
- Archive destination for each status
- Email template generation
- Edge cases (null dates, missing terms, etc.)

---

## Future Business Logic Enhancements

### Planned Rules
1. **Escalation Logic**
   - Auto-escalate if overdue by 30+ days
   - Notify manager

2. **Cost Variance Alerts**
   - Alert if finalCost > estimatedCost * 1.25

3. **Shop Performance Scoring**
   - Assign A/B/C rating based on metrics
   - Prefer A-rated shops

4. **Predictive Delivery Dates**
   - Use historical data to estimate delivery
   - ML model (future)

5. **Automated Status Progression**
   - Auto-move from SHIPPING → PAID when tracking shows delivery

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
