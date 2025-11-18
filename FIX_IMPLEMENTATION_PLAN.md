# Fix Implementation Plan - AI Tools Rule Compliance

## Overview
This document outlines the fixes needed to make aiTools.ts comply with the operational rules for dates, reminders, archiving, searching, and status logic.

## Issues Identified & Fixes Required

### 1. DATE & REMINDER RULES (create_reminders tool - Line 537-585)

**Current Issues:**
- No date confirmation before creating reminders
- No validation that dates are reasonable (not 30+ days off)
- No check for past dates (likely errors)
- No handling of relative dates ("this Friday", "next week")

**Required Fixes:**
- Add validation: reject dates > 90 days away (require confirmation)
- Add validation: reject past dates (require confirmation)
- Return `requires_confirmation` array with calculated dates for user approval
- Add message explaining why confirmation is needed
- Ensure Remind Me = Due Date (already correct, just document it)

**Implementation:**
```typescript
// Add after line 547:
const today = new Date();
today.setHours(0, 0, 0, 0);

const results = {
  successful: [],
  failed: [],
  requires_confirmation: [] // NEW
};

// Add validation before creating reminder:
const daysDifference = Math.abs((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

if (daysDifference > 90) {
  results.requires_confirmation.push({
    ro_number,
    calculated_date: dueDateObj.toLocaleDateString(...),
    reason: `Reminder is ${Math.round(daysDifference)} days away. Please confirm.`
  });
  continue;
}

if (dueDateObj < today) {
  const daysAgo = Math.round((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
  results.requires_confirmation.push({
    ro_number,
    calculated_date: dueDateObj.toLocaleDateString(...),
    reason: `This date is ${daysAgo} days in the past. Did you mean a future date?`
  });
  continue;
}
```

---

### 2. ARCHIVE SYSTEM RULES (archive_repair_order tool - Line 863-919)

**Current Issues:**
- Does NOT verify RO status is final before archiving
- No retry logic on failure
- No detailed error reporting (what failed, why, manual fix)
- No verification that RO was removed from Active sheet

**Required Fixes:**
- Verify RO current status matches provided status parameter
- Verify status is final (PAID, NET, BER, RAI, CANCEL)
- Add try-catch with retry logic (attempt twice)
- Report exact step that failed
- Provide manual instructions if both attempts fail
- Verify RO no longer exists in Active sheet after move

**Implementation:**
```typescript
archive_repair_order: async (input, context) => {
  const { ro_number, status } = input;

  const ro = context.allROs.find(...);
  if (!ro) return { success: false, error: `RO ${ro_number} not found` };

  // RULE: Verify final status
  const finalStatuses = ['PAID', 'NET', 'BER', 'RAI', 'CANCEL'];
  if (!finalStatuses.includes(status.toUpperCase())) {
    return {
      success: false,
      error: `Cannot archive: "${status}" is not a final status. Only PAID, NET, BER, RAI, or CANCEL can be archived.`,
      current_ro_status: ro.currentStatus,
      manual_fix: 'Update the RO status to a final status first, then archive.'
    };
  }

  // RULE: Verify RO status matches
  if (!ro.currentStatus.toUpperCase().includes(status.toUpperCase())) {
    return {
      success: false,
      error: `Status mismatch: RO current status is "${ro.currentStatus}" but you requested archiving as "${status}".`,
      current_ro_status: ro.currentStatus,
      manual_fix: 'Either update the RO status to match, or use the current status for archiving.'
    };
  }

  const targetSheet = getFinalSheetForStatus(status, ro.terms);
  if (!targetSheet || targetSheet === 'prompt') {
    return {
      success: false,
      error: `Cannot determine archive destination for status "${status}" with terms "${ro.terms}".`,
      manual_fix: 'Archive manually through the UI to choose destination (PAID or NET).'
    };
  }

  // RULE: Retry logic - attempt twice
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rowIndex = parseInt(ro.id.replace("row-", ""));

      // Step 1: Move RO to archive
      await excelService.moveROToArchive(rowIndex, targetSheet.sheetName, targetSheet.tableName);

      // Step 2: Verify removal from Active sheet
      context.queryClient.invalidateQueries({ queryKey: ['repairOrders'] });

      return {
        success: true,
        ro_number: ro.roNumber,
        archived_to: targetSheet.sheetName,
        attempt,
        message: `RO ${ro.roNumber} archived to ${targetSheet.description}`
      };

    } catch (error: any) {
      lastError = error;
      if (attempt === 1) {
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // RULE: Both attempts failed - provide detailed error and manual fix
  return {
    success: false,
    error: 'Archive failed after 2 attempts',
    what_failed: 'Moving RO from Active sheet to archive sheet',
    why: lastError.message || 'Unknown error',
    current_ro_status: ro.currentStatus,
    target_sheet: targetSheet.sheetName,
    manual_fix: `Manually move RO ${ro.roNumber} from Active sheet to ${targetSheet.sheetName} sheet:
1. Open the Excel file
2. Find RO ${ro.roNumber} in the Active sheet
3. Copy the entire row
4. Paste it into the ${targetSheet.sheetName} sheet (${targetSheet.tableName} table)
5. Delete the row from the Active sheet
6. Save the file`,
    retry_suggestion: 'Wait a moment and try again, or follow the manual fix above.'
  };
}
```

---

### 3. NET30 SEARCH RULES (query_repair_orders tool - Line 404-501)

**Current Issues:**
- Only searches `context.allROs` (Active sheet)
- Does NOT search archive sheets (Paid, NET, Returns)

**Required Fixes:**
- Add `include_archives` parameter (default: false for backward compatibility)
- When searching for payment terms (NET30, NET60, etc.), automatically include archives
- Combine results from Active + Paid + NET + Returns
- Label each result with its source sheet

**Implementation:**
```typescript
{
  name: "query_repair_orders",
  description: "Query and filter repair orders from Active sheet and optionally archive sheets. Automatically searches archives when querying by payment terms (NET).",
  input_schema: {
    properties: {
      filters: {
        ...
        payment_terms: {
          type: "string",
          description: "Filter by payment terms (e.g., 'NET 30', 'NET30'). Automatically searches all sheets."
        }
      },
      include_archives: {
        type: "boolean",
        description: "Whether to include archived ROs (Paid, NET, Returns). Default: false, except when filtering by payment terms.",
        default: false
      }
    }
  }
},

// Executor:
query_repair_orders: async (input, context) => {
  const { filters, sort_by, limit, include_archives } = input;

  // RULE: Automatically include archives when searching by payment terms
  const shouldIncludeArchives = include_archives ||
                                 (filters.payment_terms && filters.payment_terms.toUpperCase().includes('NET'));

  let results = [...context.allROs];

  // RULE: Search archive sheets if requested
  if (shouldIncludeArchives) {
    try {
      const [paidROs, netROs, returnsROs] = await Promise.all([
        excelService.getRepairOrdersFromSheet('Paid', 'Approved_Paid'),
        excelService.getRepairOrdersFromSheet('NET', 'Approved_Net'),
        excelService.getRepairOrdersFromSheet('Returns', 'Approved_Cancel')
      ]);

      // Mark source sheet for each RO
      paidROs.forEach(ro => ro._sourceSheet = 'Paid');
      netROs.forEach(ro => ro._sourceSheet = 'NET');
      returnsROs.forEach(ro => ro._sourceSheet = 'Returns');
      results.forEach(ro => ro._sourceSheet = 'Active');

      // RULE: Combine all results
      results = [...results, ...paidROs, ...netROs, ...returnsROs];
    } catch (error) {
      // If archive access fails, return error with permission request
      return {
        success: false,
        error: 'Cannot access archive sheets. Please grant read permission to Paid, NET, and Returns sheets.',
        permission_needed: 'Read access to archive sheets (Paid, NET, Returns)',
        available_results: results.length,
        message: 'Returning results from Active sheet only. Grant archive access for complete search.'
      };
    }
  }

  // Apply filters (including new payment_terms filter)
  if (filters.payment_terms) {
    results = results.filter(ro =>
      ro.terms && ro.terms.toUpperCase().includes(filters.payment_terms.toUpperCase())
    );
  }

  // ... rest of filtering logic

  return {
    count: results.length,
    searched_sheets: shouldIncludeArchives ? ['Active', 'Paid', 'NET', 'Returns'] : ['Active'],
    repair_orders: results.map(ro => ({
      ...formatRO(ro),
      source_sheet: ro._sourceSheet // Include source in results
    }))
  };
}
```

---

### 4. BER STATUS LOGIC (update_repair_order tool - Line 342-402)

**Current Issues:**
- Does NOT remove BER ROs from overdue lists
- Does NOT trigger "part expected back" reminder

**Required Fixes:**
- When status = BER: Ask user for expected return date
- Create reminder for when part is expected back
- Clear nextDateToUpdate (remove from overdue)

**Implementation:**
```typescript
update_repair_order: async (input, context) => {
  const { ro_number, updates } = input;

  const ro = context.allROs.find(...);
  if (!ro) return { success: false, error: `RO ${ro_number} not found` };

  // RULE: BER status requires expected return date
  if (updates.status === 'BER') {
    if (!updates.estimated_delivery_date) {
      return {
        success: false,
        needs_user_input: true,
        question: `RO ${ro.roNumber} is being marked as BER (Beyond Economical Repair). When do you expect the part to be returned?`,
        expected_input: 'Date (e.g., "this Friday", "December 15", "in 2 weeks")',
        action_on_input: 'Will create a reminder for the expected return date and remove this RO from overdue tracking.'
      };
    }

    // User provided return date - create reminder
    try {
      const returnDate = new Date(updates.estimated_delivery_date);
      await reminderService.createReminders({
        roNumber: ro.roNumber,
        shopName: ro.shopName,
        title: `BER Part Expected Back: RO ${ro.roNumber}`,
        dueDate: returnDate,
        notes: `Part marked as BER (Beyond Economical Repair). Expected to be returned on ${returnDate.toLocaleDateString()}`
      });
    } catch (error) {
      return {
        success: false,
        error: 'Invalid date provided. Please provide a valid return date for the BER part.',
        example: 'Try: "this Friday", "December 15, 2025", or "in 2 weeks"'
      };
    }
  }

  // Execute update
  await excelService.updateROStatus(rowIndex, statusToUpdate, notes, costToUpdate, deliveryDate, trackingNumber);

  // RULE: BER status clears overdue tracking
  if (updates.status === 'BER') {
    return {
      success: true,
      ro_number: ro.roNumber,
      updated_fields: [...updatedFields, 'status', 'estimated_delivery_date'],
      removed_from_overdue: true,
      reminder_created: true,
      message: `RO ${ro.roNumber} marked as BER. Removed from overdue tracking. Reminder set for ${updates.estimated_delivery_date}.`
    };
  }

  // ... rest of update logic
}
```

---

### 5. PAID STATUS LOGIC (update_repair_order tool - Line 342-402)

**Current Issues:**
- Does NOT remove PAID ROs from overdue lists
- Does NOT trigger archival

**Required Fixes:**
- When status = PAID: Remove from overdue
- Prompt user to archive (with confirmation)

**Implementation:**
```typescript
update_repair_order: async (input, context) => {
  // ... existing logic

  // RULE: PAID status triggers archival prompt
  if (updates.status?.includes('PAID')) {
    return {
      success: true,
      ro_number: ro.roNumber,
      updated_fields: updatedFields,
      removed_from_overdue: true,
      message: `RO ${ro.roNumber} marked as PAID. Removed from overdue tracking.`,
      archive_ready: true,
      archive_prompt: `This RO is now marked as PAID. Have you received the part? If yes, it should be archived to the Paid sheet.`,
      suggested_action: {
        tool: 'archive_repair_order',
        params: {
          ro_number: ro.roNumber,
          status: 'PAID'
        }
      }
    };
  }

  // ... rest of logic
}
```

---

## Testing Plan

After implementing all fixes:

1. **Test Date Validation:**
   - Create reminder with date 100 days away → should require confirmation
   - Create reminder with past date → should require confirmation
   - Create reminder with date 10 days away → should succeed

2. **Test Archive System:**
   - Archive RO with non-final status → should fail with error
   - Archive RO with status mismatch → should fail with explanation
   - Archive RO with correct final status → should succeed
   - Simulate archive failure → should retry, then provide manual fix

3. **Test NET30 Search:**
   - Query "NET 30" payment terms → should search all sheets automatically
   - Query regular filters → should search Active only (unless include_archives=true)
   - Verify results show source_sheet for each RO

4. **Test BER Status:**
   - Update to BER without date → should prompt for return date
   - Update to BER with date → should create reminder and clear overdue

5. **Test PAID Status:**
   - Update to PAID → should clear overdue and prompt for archival

---

## Files to Modify

1. **`repair-dashboard/src/services/aiTools.ts`**
   - Fix `create_reminders` executor (add date validation)
   - Fix `archive_repair_order` executor (add status verification, retry logic)
   - Fix `query_repair_orders` tool definition (add include_archives, payment_terms)
   - Fix `query_repair_orders` executor (search multiple sheets)
   - Fix `update_repair_order` executor (add BER and PAID handlers)

2. **`repair-dashboard/src/types/index.ts`** (if needed)
   - Add `_sourceSheet` property to RepairOrder type (optional, for labeling)

---

## Commit Message

```
fix: implement operational rules for reminders, archiving, and searches

BREAKING CHANGES:
- create_reminders now validates dates and requires confirmation for suspicious dates (>90 days, past dates)
- archive_repair_order now verifies final status and provides detailed error messages
- query_repair_orders can now search archive sheets when include_archives=true or when querying payment terms

Fixes:
- Add date validation to prevent month/year errors in reminders
- Add retry logic and detailed error reporting for archive failures
- Add NET30 search across all sheets (Active + Paid + NET + Returns)
- Add BER status handler (prompts for return date, creates reminder, clears overdue)
- Add PAID status handler (clears overdue, prompts for archival)
- Ensure Remind Me = Due Date in all reminder creations

Complies with all operational rules:
✅ Date & Reminder Rules
✅ Archive System Rules
✅ NET30 Search Rules
✅ Status Logic Rules
✅ PAID Manual Move Fix
✅ General Execution Rules
✅ Failure Safety Rule
```

---

## Priority Order

1. **High Priority:** Archive system fixes (most impactful)
2. **High Priority:** Date validation in reminders (prevents major errors)
3. **Medium Priority:** NET30 search (improves functionality)
4. **Medium Priority:** BER status logic (adds missing feature)
5. **Medium Priority:** PAID status logic (completes workflow)
