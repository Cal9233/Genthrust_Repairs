# Excel Module - Refactored Architecture

This directory contains the refactored Excel service, organized using the **Repository Pattern** and **Facade Pattern** for better separation of concerns.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     excelService.ts                          │
│                    (Facade Pattern)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  - Coordinates between specialized modules             │ │
│  │  - Maintains backward compatibility                    │ │
│  │  - Handles file discovery and AI logging              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                  │
         ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌───────────────────┐
│ GraphClient  │  │SessionManager│  │RepairOrderRepo    │
│              │  │              │  │                   │
│ - MSAL auth  │  │ - Session    │  │ - CRUD ops        │
│ - HTTP calls │  │   lifecycle  │  │ - Data parsing    │
│ - Token mgmt │  │ - Retry logic│  │ - Business logic  │
└──────────────┘  └──────────────┘  └───────────────────┘
```

## Module Responsibilities

### 1. **GraphClient.ts**
**Purpose:** Microsoft Graph API HTTP client

**Responsibilities:**
- MSAL authentication (silent, popup, redirect flows)
- HTTP request/response handling
- Token acquisition and management
- Get current user information
- Error handling for Graph API responses

**Key Methods:**
- `setMsalInstance(instance)` - Initialize with MSAL
- `getAccessToken()` - Acquire access token
- `callGraphAPI<T>(endpoint, method, body, sessionId)` - Make Graph API calls
- `getCurrentUser()` - Get authenticated user name

**File:** `repair-dashboard/src/lib/excel/GraphClient.ts`

---

### 2. **SessionManager.ts**
**Purpose:** Excel workbook session management

**Responsibilities:**
- Create and close Excel sessions
- Retry logic with exponential backoff
- Concurrent operation safety (locking)
- Connection health checks
- Session lifecycle management

**Key Methods:**
- `withSession<T>(operation)` - Execute operation with auto session handling
- `executeWithSession<T>(endpoint, method, body)` - Single API call with session
- `checkHealth()` - Verify connection to Excel file
- `getSessionInfo()` - Get current session state (debugging)

**Features:**
- Automatic session creation/cleanup
- Retries up to 3 times with exponential backoff
- Session timeout: 30 minutes
- Concurrent operation queueing

**File:** `repair-dashboard/src/lib/excel/SessionManager.ts`

---

### 3. **RepairOrderRepository.ts**
**Purpose:** Repair Order CRUD operations and data mapping

**Responsibilities:**
- Excel date/currency parsing
- Status history serialization/deserialization
- Create, read, update, delete repair orders
- Archive operations
- Data transformation between Excel and application models

**Key Methods:**
- `getRepairOrders()` - Get all active ROs
- `getRepairOrdersFromSheet(sheetName, tableName)` - Get archived ROs
- `addRepairOrder(data)` - Create new RO
- `updateRepairOrder(rowIndex, data)` - Update RO fields
- `updateROStatus(...)` - Update status with business logic
- `deleteRepairOrder(rowIndex)` - Delete RO
- `moveROToArchive(rowIndex, targetSheet, targetTable)` - Archive RO

**Private Methods (Data Mapping):**
- `parseExcelDate(value)` - Convert Excel serial date to JS Date
- `parseCurrency(value)` - Parse currency values
- `parseNotesWithHistory(notes)` - Extract status history from notes
- `serializeNotesWithHistory(notes, history)` - Embed history in notes
- `mapRowToRepairOrder(values, index)` - Map Excel row to RepairOrder object

**File:** `repair-dashboard/src/lib/excel/RepairOrderRepository.ts`

---

### 4. **excelService.ts** (Refactored Facade)
**Purpose:** Unified interface for Excel operations

**Responsibilities:**
- Initialize and coordinate between modules
- Maintain backward compatibility with existing hooks
- SharePoint file discovery
- AI logging operations (not delegated)

**Public API (unchanged for backward compatibility):**
- All repair order methods (delegated to `RepairOrderRepository`)
- File operations (`getFileId`, `getFileInfo`, `searchForFile`)
- AI logging (`addLogToExcelTable`, `getLogsFromExcelTable`)

**File:** `repair-dashboard/src/lib/excelService.ts`

---

## Benefits of This Architecture

### 1. **Single Responsibility Principle**
Each module has one clear purpose:
- `GraphClient`: HTTP communication
- `SessionManager`: Session lifecycle
- `RepairOrderRepository`: Data operations

### 2. **Easier Testing**
- Mock `GraphClient` for testing repository
- Test session logic independently
- Test data parsing without API calls

### 3. **Better Maintainability**
- Smaller files (300-600 lines vs 1300+ lines)
- Clear boundaries between concerns
- Easier to locate and fix bugs

### 4. **Reusability**
- `GraphClient` can be used for other Graph API calls
- `SessionManager` can manage sessions for other Excel operations
- Patterns can be reused for other repositories (e.g., `ShopRepository`)

### 5. **Backward Compatibility**
- Existing hooks (`useROs`, `useShops`) work without changes
- Same public API surface
- No migration needed

---

## Migration Guide

### Before (Old Structure)
```typescript
import { excelService } from "../lib/excelService";

// All operations through one large service
await excelService.getRepairOrders();
```

### After (Refactored - Same API!)
```typescript
import { excelService } from "../lib/excelService";

// Same API, internally delegated to specialized modules
await excelService.getRepairOrders();
```

### For New Code (Direct Module Access)
```typescript
import { graphClient } from "../lib/excel/GraphClient";
import { SessionManager } from "../lib/excel/SessionManager";
import { RepairOrderRepository } from "../lib/excel/RepairOrderRepository";

// Use modules directly if needed
const token = await graphClient.getAccessToken();
```

---

## File Structure

```
repair-dashboard/src/lib/
├── excel/
│   ├── GraphClient.ts          # HTTP client for Graph API
│   ├── SessionManager.ts        # Session management
│   ├── RepairOrderRepository.ts # RO CRUD operations
│   ├── index.ts                 # Module exports
│   └── README.md                # This file
├── excelService.ts              # Facade (refactored)
├── excelService.ts.backup       # Original (backup)
└── excelSession.ts              # Legacy (can be removed)
```

---

## Testing

All TypeScript types compile successfully:
```bash
cd repair-dashboard
npx tsc --noEmit  # ✅ No errors
```

Existing hooks continue to work:
- `useROs.ts` - ✅ Uses `excelService`
- `useShops.ts` - ✅ Uses `shopService` (not affected)
- `useInventoryFile.ts` - ✅ Uses `excelService`

---

## Future Improvements

1. **Create ShopRepository**
   - Extract shop operations from `shopService.ts`
   - Follow same pattern as `RepairOrderRepository`

2. **Add Unit Tests**
   - Test `RepairOrderRepository` data parsing
   - Test `SessionManager` retry logic
   - Mock `GraphClient` for repository tests

3. **Add Caching Layer**
   - Cache file IDs, drive IDs
   - Reduce redundant API calls

4. **Consider Using Dependency Injection**
   - Pass dependencies via constructor
   - Easier to test and mock

---

**Version:** 1.0
**Created:** 2025-11-21
**Author:** Claude Code Refactoring
