# RO Number Refactor Guide - Update & Archive Operations

## Purpose
This guide provides all context needed to implement roNumber-based update and archive operations, following the same pattern established for delete in v2.5.0.

---

## Background: The ID Mismatch Problem

### Root Cause
The application has TWO incompatible ID systems:

| Data Source | ID Format | Example | Where Set |
|-------------|-----------|---------|-----------|
| **MySQL** | Auto-increment integer | `"123"` | `repair-orders.js:81` → `id: row.id.toString()` |
| **Excel** | Array index string | `"row-87"` | `RepairOrderRepository.ts:191` → `id: \`row-${index}\`` |

### Why This Causes Problems
When data comes from MySQL, the `id` field contains something like `"123"`. When it comes from Excel, it's `"row-87"`. The hybrid service tries to determine which backend to use based on the ID format, which fails when:
1. MySQL data is processed with Excel logic
2. Row indices become stale after table modifications
3. Type coercion causes unexpected routing

### Solution: Use `roNumber` as Universal Identifier
- `roNumber` (e.g., "RO-38462") is unique across both data sources
- It never changes when rows shift or data sources switch
- Both MySQL and Excel can look up records by `roNumber`

---

## What Was Implemented for Delete (v2.5.0)

### Files Modified

| File | Method Added |
|------|--------------|
| `backend/routes/repair-orders.js` | `DELETE /ros/by-number/:roNumber` |
| `repair-dashboard/src/services/repairOrderService.ts` | `deleteByRONumber(roNumber)` |
| `repair-dashboard/src/services/hybridDataService.ts` | `deleteRepairOrderByNumber(roNumber)` |
| `repair-dashboard/src/lib/excelService.ts` | `deleteRepairOrderByRONumber(roNumber)` |
| `repair-dashboard/src/lib/excel/RepairOrderRepository.ts` | `deleteRepairOrderByRONumber(roNumber)` |
| `repair-dashboard/src/hooks/useROs.ts` | Updated `useDeleteRepairOrder` to accept `roNumber` |
| `repair-dashboard/src/components/ROTable/index.tsx` | Changed to pass `deletingRO.roNumber` |

### Pattern Used

```
UI: deleteRO.mutate("RO-38462")
        │
        ▼
useDeleteRepairOrder hook
        │
        ▼
hybridDataService.deleteRepairOrderByNumber("RO-38462")
        │
        ├─► MySQL (primary): DELETE FROM active WHERE RO = "RO-38462"
        │   - Searches all 4 tables (active, paid, net, returns)
        │
        └─► Excel (fallback):
            1. Fetch current ROs
            2. Find index where ro.roNumber === "RO-38462"
            3. DELETE /rows/itemAt(index=foundIndex)
```

---

## What Needs to Be Implemented: Update & Archive

### 1. Update RO by roNumber

**Current broken flow:**
```typescript
// hybridDataService.ts:285-305
async updateRepairOrder(idOrRowIndex: string | number, data: Partial<RepairOrder>): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';
    // This type-checking causes failures when data sources mismatch
}
```

**New method to add:**
```typescript
async updateRepairOrderByNumber(roNumber: string, data: Partial<RepairOrder>): Promise<RepairOrder>
```

**Files to modify:**

| File | Change |
|------|--------|
| `backend/routes/repair-orders.js` | Add `PATCH /ros/by-number/:roNumber` endpoint |
| `repairOrderService.ts` | Add `updateByRONumber(roNumber, data)` method |
| `hybridDataService.ts` | Add `updateRepairOrderByNumber(roNumber, data)` method |
| `excelService.ts` | Add `updateRepairOrderByRONumber(roNumber, data)` wrapper |
| `RepairOrderRepository.ts` | Add `updateRepairOrderByRONumber(roNumber, data)` method |
| `useROs.ts` | Update `useUpdateRepairOrder` hook to accept `roNumber` |
| `ROTable/index.tsx` | Update edit functionality to pass `roNumber` |

### 2. Update RO Status by roNumber

**Current broken flow:**
```typescript
// hybridDataService.ts:310-336
async updateROStatus(idOrRowIndex: string | number, status: string, ...): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';
    // Same type-checking issue
}
```

**New method to add:**
```typescript
async updateROStatusByNumber(roNumber: string, status: string, notes?: string, cost?: number, deliveryDate?: Date): Promise<RepairOrder>
```

**Files to modify:**

| File | Change |
|------|--------|
| `backend/routes/repair-orders.js` | Add `PATCH /ros/by-number/:roNumber/status` endpoint |
| `repairOrderService.ts` | Add `updateStatusByRONumber(roNumber, status, ...)` method |
| `hybridDataService.ts` | Add `updateROStatusByNumber(roNumber, ...)` method |
| `excelService.ts` | Add `updateROStatusByRONumber(roNumber, ...)` wrapper |
| `RepairOrderRepository.ts` | Add `updateROStatusByRONumber(roNumber, ...)` method |
| `useROs.ts` | Update `useUpdateROStatus` hook to accept `roNumber` |
| UI components | Update to pass `roNumber` instead of `id` |

### 3. Archive RO by roNumber

**Current broken flow:**
```typescript
// hybridDataService.ts:364-393
async archiveRepairOrder(idOrRowIndex: string | number, archiveStatusOrSheet: string): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';
    // Same type-checking issue
}
```

**New method to add:**
```typescript
async archiveRepairOrderByNumber(roNumber: string, archiveStatus: 'PAID' | 'NET' | 'RETURNED'): Promise<RepairOrder>
```

**Files to modify:**

| File | Change |
|------|--------|
| `backend/routes/repair-orders.js` | Add `POST /ros/by-number/:roNumber/archive` endpoint |
| `repairOrderService.ts` | Add `archiveByRONumber(roNumber, archiveStatus)` method |
| `hybridDataService.ts` | Add `archiveRepairOrderByNumber(roNumber, archiveStatus)` method |
| `excelService.ts` | Add `archiveRepairOrderByRONumber(roNumber, archiveStatus)` wrapper |
| `RepairOrderRepository.ts` | Add `archiveRepairOrderByRONumber(roNumber, archiveStatus)` method |
| `useROs.ts` | Update `useArchiveRO` hook to accept `roNumber` |
| UI components | Update to pass `roNumber` instead of `id` |

---

## Backend Endpoint Patterns

### Existing Delete Endpoint (reference)
```javascript
// backend/routes/repair-orders.js
router.delete('/by-number/:roNumber', async (req, res) => {
  const { roNumber } = req.params;

  // Search all tables for the RO by roNumber
  for (const [archiveStatus, tableName] of Object.entries(ARCHIVE_TABLE_MAP)) {
    const [existing] = await pool.query(
      `SELECT id FROM ${tableName} WHERE RO = ?`,
      [roNumber]
    );

    if (existing.length > 0) {
      await pool.query(`DELETE FROM ${tableName} WHERE RO = ?`, [roNumber]);
      return res.json({ success: true, message: `...` });
    }
  }

  return res.status(404).json({ error: 'Repair order not found' });
});
```

### New Update Endpoint Pattern
```javascript
router.patch('/by-number/:roNumber', async (req, res) => {
  const { roNumber } = req.params;
  const updates = req.body;

  // Search all tables for the RO by roNumber
  for (const [archiveStatus, tableName] of Object.entries(ARCHIVE_TABLE_MAP)) {
    const [existing] = await pool.query(
      `SELECT * FROM ${tableName} WHERE RO = ?`,
      [roNumber]
    );

    if (existing.length > 0) {
      // Build UPDATE query with field mapping
      // ... update logic ...
      return res.json(updatedRO);
    }
  }

  return res.status(404).json({ error: 'Repair order not found' });
});
```

### New Status Update Endpoint Pattern
```javascript
router.patch('/by-number/:roNumber/status', async (req, res) => {
  const { roNumber } = req.params;
  const { status, notes, cost, deliveryDate } = req.body;

  // Search all tables, update status, recalculate nextDateToUpdate
  // ... status update logic with business rules ...
});
```

### New Archive Endpoint Pattern
```javascript
router.post('/by-number/:roNumber/archive', async (req, res) => {
  const { roNumber } = req.params;
  const { archiveStatus } = req.body; // 'PAID', 'NET', or 'RETURNED'

  // Find RO in current table
  // Move to target table (INSERT + DELETE in transaction)
  // Return archived RO
});
```

---

## Excel/Repository Pattern

### Existing Delete Method (reference)
```typescript
// RepairOrderRepository.ts
async deleteRepairOrderByRONumber(roNumber: string): Promise<void> {
  // First, get all repair orders to find the one with matching roNumber
  const repairOrders = await this.getRepairOrders();
  const targetRO = repairOrders.find(ro => ro.roNumber === roNumber);

  if (!targetRO) {
    throw new Error(`Repair order ${roNumber} not found in Excel`);
  }

  // Extract the row index from the id (format: "row-{index}")
  const rowIndex = parseInt(targetRO.id.replace('row-', ''), 10);

  // Delete by the found row index
  await this.deleteRepairOrder(rowIndex);
}
```

### New Update Method Pattern
```typescript
async updateRepairOrderByRONumber(roNumber: string, data: Partial<RepairOrder>): Promise<RepairOrder> {
  const repairOrders = await this.getRepairOrders();
  const targetRO = repairOrders.find(ro => ro.roNumber === roNumber);

  if (!targetRO) {
    throw new Error(`Repair order ${roNumber} not found in Excel`);
  }

  const rowIndex = parseInt(targetRO.id.replace('row-', ''), 10);
  await this.updateRepairOrder(rowIndex, data);

  // Refetch to return updated RO
  const updatedOrders = await this.getRepairOrders();
  return updatedOrders.find(ro => ro.roNumber === roNumber)!;
}
```

---

## UI Components That Need Updates

### ROTable/index.tsx
- Edit RO functionality (likely in a dialog)
- Status update button/dialog
- Archive button

### UpdateStatusDialog.tsx (if exists)
- Should pass `roNumber` instead of `id`

### EditRODialog.tsx (if exists)
- Should pass `roNumber` instead of `id`

---

## TDD Test Pattern

Create tests in `tests/services/` following this pattern:

```typescript
// tests/services/hybridDataService.updateByRONumber.test.ts
describe('HybridDataService - updateRepairOrderByNumber', () => {
  describe('MySQL Primary Path', () => {
    it('updates RO in MySQL when MySQL succeeds');
    it('updates RO in active table');
    it('updates RO in paid table');
    it('updates RO in net table');
    it('updates RO in returns table');
  });

  describe('Excel Fallback Path', () => {
    it('falls back to Excel when MySQL fails');
    it('finds RO by roNumber and updates by index');
  });

  describe('Both Sources Fail', () => {
    it('throws comprehensive error when both fail');
  });

  describe('Edge Cases', () => {
    it('handles empty roNumber');
    it('handles RO not found');
    it('handles partial updates');
  });
});
```

---

## Important Notes

1. **Route Order Matters**: In Express, specific routes like `/by-number/:roNumber` MUST come BEFORE wildcard routes like `/:id`

2. **Backward Compatibility**: Keep existing methods marked as `@deprecated` but functional

3. **Empty roNumber Handling**: Check for empty/null roNumber before API calls (see delete implementation)

4. **URL Encoding**: Use `encodeURIComponent(roNumber)` in frontend API calls

5. **Transaction Safety**: Archive operations should use MySQL transactions (BEGIN/COMMIT/ROLLBACK)

6. **Business Rules**: Status updates should recalculate `nextDateToUpdate` using `calculateNextUpdateDate()` from `businessRules.ts`

---

## File Locations Quick Reference

```
backend/
  └── routes/repair-orders.js          # Backend API endpoints

repair-dashboard/src/
  ├── services/
  │   ├── repairOrderService.ts        # MySQL API client
  │   └── hybridDataService.ts         # MySQL/Excel fallback orchestration
  ├── lib/
  │   ├── excelService.ts              # Excel service facade
  │   ├── excel/
  │   │   └── RepairOrderRepository.ts # Excel CRUD operations
  │   └── businessRules.ts             # Status → nextDateToUpdate calculation
  ├── hooks/
  │   └── useROs.ts                    # React Query mutations
  └── components/
      └── ROTable/index.tsx            # Main table UI

tests/services/
  └── hybridDataService.deleteByRONumber.test.ts  # Reference test file
```

---

## Commits from Delete Implementation (v2.5.0)

For reference on commit message format and scope:
- `0496ca0` - test: Add TDD tests for delete RO by roNumber (v2.5.0)
- `548ba3e` - feat: Implement delete RO by roNumber (v2.5.0)
- `61cf68d` - fix: Handle delete for ROs with empty roNumber (v2.5.0)

---

**Last Updated:** 2025-11-29
**Related:** `.claude/CHANGELOG.md` (v2.5.0 section)

---

## TDD Approach (REQUIRED)

### Process We Followed for Delete

1. **Document findings first** - Update `.claude/CHANGELOG.md` with:
   - Issue description
   - Root cause analysis
   - Proposed solution
   - Files to modify

2. **Create TDD tests BEFORE implementation** - Write comprehensive mock tests that:
   - Simulate production behavior accurately
   - Cover MySQL primary path
   - Cover Excel fallback path
   - Cover both-fail scenarios
   - Cover edge cases (empty roNumber, not found, etc.)

3. **Verify tests pass** - Run tests to ensure mock logic is correct

4. **Implement actual code** - Only after tests pass, implement the real methods

5. **Run tests again** - Verify implementation matches expected behavior

6. **Commit in phases**:
   - `test:` commit for TDD tests
   - `feat:` commit for implementation
   - `fix:` commit for edge cases discovered during testing

### TDD Test Structure (Reference)

See `tests/services/hybridDataService.deleteByRONumber.test.ts` (374 lines, 30 tests):

```typescript
/**
 * TDD Tests for HybridDataService.deleteRepairOrderByNumber
 *
 * These tests define the expected behavior BEFORE implementation.
 * Mock classes simulate production behavior to validate logic.
 */

// ============================================================================
// MOCK IMPLEMENTATIONS (Simulate Production Behavior)
// ============================================================================

class MockMySQLService {
  private database: Map<string, MockRepairOrder[]>;

  constructor() {
    this.database = new Map([
      ['active', []],
      ['paid', []],
      ['net', []],
      ['returns', []]
    ]);
  }

  async deleteByRONumber(roNumber: string): Promise<{ success: boolean; message: string }> {
    // Search all 4 tables
    const tables = ['active', 'paid', 'net', 'returns'];
    for (const tableName of tables) {
      const table = this.database.get(tableName) || [];
      const index = table.findIndex(ro => ro.roNumber === roNumber);
      if (index !== -1) {
        table.splice(index, 1);
        return { success: true, message: `Deleted from ${tableName}` };
      }
    }
    throw new Error(`HTTP 404: Repair order ${roNumber} not found`);
  }
}

class MockExcelService {
  private data: MockRepairOrder[] = [];

  async deleteRepairOrderByRONumber(roNumber: string): Promise<void> {
    const currentData = await this.getRepairOrders();
    const targetIndex = currentData.findIndex(ro => ro.roNumber === roNumber);
    if (targetIndex === -1) {
      throw new Error(`Repair order ${roNumber} not found in Excel`);
    }
    await this.deleteRepairOrder(targetIndex);
  }
}

class MockHybridDataService {
  async deleteRepairOrderByNumber(roNumber: string): Promise<void> {
    // TRY MYSQL FIRST
    try {
      this.metrics.mysqlAttempts++;
      await this.mysql.deleteByRONumber(roNumber);
      this.metrics.mysqlSuccesses++;
      return;
    } catch (mysqlError) {
      this.metrics.mysqlFailures++;
      this.lastError.mysql = mysqlError as Error;
    }

    // FALLBACK TO EXCEL
    try {
      this.metrics.excelAttempts++;
      await this.excel.deleteRepairOrderByRONumber(roNumber);
      this.metrics.excelSuccesses++;
      return;
    } catch (excelError) {
      this.metrics.excelFailures++;
      this.lastError.excel = excelError as Error;
    }

    throw new Error(`Both MySQL and Excel failed...`);
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('HybridDataService - deleteRepairOrderByNumber', () => {

  describe('MySQL Primary Path (Happy Path)', () => {
    it('deletes RO from MySQL active table');
    it('deletes RO from MySQL paid table');
    it('deletes RO from MySQL net table');
    it('deletes RO from MySQL returns table');
    it('does not attempt Excel when MySQL succeeds');
    it('tracks metrics correctly');
  });

  describe('Excel Fallback Path', () => {
    it('falls back to Excel when MySQL fails');
    it('finds RO by roNumber in Excel');
    it('deletes by found row index');
    it('tracks fallback metrics');
  });

  describe('Both Sources Fail', () => {
    it('throws comprehensive error');
    it('includes both error messages');
    it('tracks failure metrics');
  });

  describe('Edge Cases', () => {
    it('handles empty roNumber');
    it('handles whitespace-only roNumber');
    it('handles RO not found in any source');
    it('handles special characters in roNumber');
  });

  describe('Backward Compatibility', () => {
    it('old deleteRepairOrder method still works with number');
    it('old deleteRepairOrder method still works with string');
  });
});
```

---

## CHANGELOG Update Template

### Before Implementation

Add this to `.claude/CHANGELOG.md` at the top of Version History:

```markdown
### v2.6.0 - Update/Archive RO by RO Number Refactor (YYYY-MM-DD)

**Status:** 🔄 In Progress

**Issue:** Update and Archive operations fail due to ID system mismatch

**Root Cause:** Same as v2.5.0 delete issue - MySQL uses auto-increment IDs while Excel uses row indices. The type-checking in hybridDataService causes routing failures.

**Solution:** Apply same roNumber-based pattern established in v2.5.0 for delete operations.

---

#### Proposed Changes

| File | Change |
|------|--------|
| `backend/routes/repair-orders.js` | Add `PATCH /ros/by-number/:roNumber` and `POST /ros/by-number/:roNumber/archive` |
| `repairOrderService.ts` | Add `updateByRONumber()` and `archiveByRONumber()` methods |
| `hybridDataService.ts` | Add `updateRepairOrderByNumber()` and `archiveRepairOrderByNumber()` methods |
| `excelService.ts` | Add wrapper methods |
| `RepairOrderRepository.ts` | Add Excel CRUD methods |
| `useROs.ts` | Update hooks to accept roNumber |
| UI components | Update to pass roNumber |

---

#### Implementation Phases

**Phase 1: TDD Tests**
- Create `tests/services/hybridDataService.updateByRONumber.test.ts`
- Create `tests/services/hybridDataService.archiveByRONumber.test.ts`
- Verify mock logic before implementation

**Phase 2: Backend Endpoints**
- Add `PATCH /ros/by-number/:roNumber`
- Add `PATCH /ros/by-number/:roNumber/status`
- Add `POST /ros/by-number/:roNumber/archive`

**Phase 3: Service Layer**
- Add methods to repairOrderService.ts
- Add methods to hybridDataService.ts
- Add methods to excelService.ts and repository

**Phase 4: UI Layer**
- Update useROs.ts hooks
- Update ROTable and dialog components

**Phase 5: Testing & Verification**
- Run all tests
- Manual testing
- TypeScript compilation check
```

### After Implementation

Update the status and add implementation details:

```markdown
**Status:** ✅ Complete

#### Implementation Complete (YYYY-MM-DD)

**Files Modified:**

| File | Changes |
|------|---------|
| `backend/routes/repair-orders.js` | Added PATCH and POST by-number endpoints |
| ... | ... |

**Tests:**
- `tests/services/hybridDataService.updateByRONumber.test.ts` - XX tests
- `tests/services/hybridDataService.archiveByRONumber.test.ts` - XX tests
- All tests passing ✅

**Commits:**
- `XXXXXXX` - test: Add TDD tests for update/archive by roNumber (v2.6.0)
- `XXXXXXX` - feat: Implement update/archive by roNumber (v2.6.0)
```

---

## Workflow Summary

```
1. READ .claude/RONUM_REFACTOR_GUIDE.md (this file)
       │
       ▼
2. UPDATE .claude/CHANGELOG.md with v2.6.0 entry (Status: In Progress)
       │
       ▼
3. CREATE TDD tests (do NOT implement yet)
   - tests/services/hybridDataService.updateByRONumber.test.ts
   - tests/services/hybridDataService.archiveByRONumber.test.ts
       │
       ▼
4. RUN tests to verify mock logic
   npm run test -- --run tests/services/hybridDataService.updateByRONumber.test.ts
       │
       ▼
5. COMMIT tests
   git commit -m "test: Add TDD tests for update/archive by roNumber (v2.6.0)"
       │
       ▼
6. IMPLEMENT actual code (backend → services → hooks → UI)
       │
       ▼
7. RUN TypeScript check
   npx tsc --noEmit
       │
       ▼
8. RUN all tests
   npm run test -- --run
       │
       ▼
9. COMMIT implementation
   git commit -m "feat: Implement update/archive by roNumber (v2.6.0)"
       │
       ▼
10. UPDATE CHANGELOG.md (Status: Complete)
       │
       ▼
11. PUSH to branch (do NOT merge to main without approval)
```
