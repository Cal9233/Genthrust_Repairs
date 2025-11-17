# modules.md - Module Breakdown & Responsibilities

## Purpose
This document describes all modules, services, and their responsibilities within the GenThrust RO Tracker. It serves as a directory of "who does what" in the codebase.

---

## Module Organization

```
repair-dashboard/src/
├── lib/                    # Core business services
├── services/               # External integrations
├── hooks/                  # React Query data hooks
├── components/             # UI components
├── config/                 # Configuration files
├── types/                  # TypeScript type definitions
└── utils/                  # Utility functions
```

---

## Core Services (lib/)

### 1. excelService.ts
**Purpose:** Manages all SharePoint Excel operations for repair orders

**Responsibilities:**
- Read repair orders from Excel tables
- Update RO status, notes, costs, dates
- Archive ROs to different sheets (PAID, NET, Returns)
- Delete repair orders
- Manage workbook sessions for write operations
- Parse Excel dates and currency values
- Search for Excel files in SharePoint
- List workbook structure (sheets, tables, columns)

**Key Methods:**
```typescript
class ExcelService {
  // Read operations
  getRepairOrders(): Promise<RepairOrder[]>
  getArchivedROs(sheetName: string): Promise<RepairOrder[]>
  searchForFile(fileName: string): Promise<FileSearchResult>
  listFileStructure(fileId: string): Promise<WorkbookStructure>

  // Write operations
  addRepairOrder(data: Partial<RepairOrder>): Promise<void>
  updateRepairOrder(rowIndex: number, data: Partial<RepairOrder>): Promise<void>
  updateROStatus(rowIndex, status, notes, cost, deliveryDate): Promise<void>
  appendNote(rowIndex: number, note: string): Promise<void>
  moveROToArchive(rowIndex, targetSheet, targetTable): Promise<void>
  deleteRepairOrder(rowIndex: number): Promise<void>

  // Session management
  private createSession(): Promise<string>
  private closeSession(sessionId: string): Promise<void>

  // Helpers
  private parseExcelDate(value: any): Date | null
  private parseCurrency(value: any): number | null
  private getAccessToken(): Promise<string>
  private callGraphAPI(endpoint, method, body, sessionId): Promise<any>
}
```

**Dependencies:**
- MSAL (authentication)
- Microsoft Graph API
- businessRules (for next update date calculation)
- reminderService (for automated reminders)
- excelSession (session management)

**File Location:** `repair-dashboard/src/lib/excelService.ts`

---

### 2. shopService.ts
**Purpose:** Manages shop directory CRUD operations

**Responsibilities:**
- Read all shops from Shops.xlsx
- Add new shop
- Update shop details
- Delete shop
- Parse shop data (dates, numbers)

**Key Methods:**
```typescript
class ShopService {
  getShops(): Promise<Shop[]>
  addShop(shopData: Partial<Shop>): Promise<void>
  updateShop(rowIndex: number, shopData: Partial<Shop>): Promise<void>
  deleteShop(rowIndex: number): Promise<void>

  // Helpers
  private parseShopData(row: any): Shop
  private getAccessToken(): Promise<string>
  private callGraphAPI(endpoint, method, body, sessionId): Promise<any>
}
```

**Dependencies:**
- MSAL (authentication)
- Microsoft Graph API
- excelSession (session management)

**File Location:** `repair-dashboard/src/lib/shopService.ts`

---

### 3. reminderService.ts
**Purpose:** Creates reminders in Microsoft To Do and Calendar

**Responsibilities:**
- Create To Do tasks for RO follow-ups
- Create Calendar events for payment due dates
- Calculate reminder dates based on business rules
- Detect NET payment terms and schedule accordingly

**Key Methods:**
```typescript
class ReminderService {
  // To Do tasks
  createToDoTask(title, dueDate, notes): Promise<void>

  // Calendar events
  createCalendarEvent(title, startDate, notes): Promise<void>
  createPaymentDueCalendarEvent(roNumber, shopName, amount, netDays): Promise<void>

  // Helpers
  private extractNetDays(terms: string): number | null
  private calculatePaymentDueDate(receivedDate: Date, netDays: number): Date
}
```

**Dependencies:**
- MSAL (authentication)
- Microsoft Graph API (To Do & Calendar)

**File Location:** `repair-dashboard/src/lib/reminderService.ts`

---

### 4. businessRules.ts
**Purpose:** Centralized business logic for RO status and date calculations

**Responsibilities:**
- Calculate next update date based on status
- Determine archive destination (PAID vs NET vs Returns)
- Status validation
- Payment term parsing

**Key Functions:**
```typescript
// Calculate when to follow up based on status
calculateNextUpdateDate(status: string, statusDate: Date, paymentTerms?: string): Date | null

// Determine which archive sheet to use
determineArchiveDestination(status: string, paymentTerms: string): 'PAID' | 'NET' | 'Returns' | null

// Extract NET days from payment terms (e.g., "NET 30" -> 30)
extractNetDays(terms: string): number | null

// Validate status transitions
validateStatusTransition(currentStatus: string, newStatus: string): boolean
```

**Business Rules Encoded:**
- TO SEND → 3 days
- WAITING QUOTE → 14 days
- APPROVED → 7 days
- BEING REPAIRED → 10 days
- CURRENTLY BEING SHIPPED → 5 days
- RECEIVED → 3 days
- SHIPPING → 3 days
- PAID → Based on payment terms

**File Location:** `repair-dashboard/src/lib/businessRules.ts`

---

### 5. loggingService.ts
**Purpose:** Log AI interactions to SharePoint/OneDrive for audit trail

**Responsibilities:**
- Log AI commands and results to daily Excel files
- Create new log files if they don't exist
- Append entries to existing logs
- Retrieve logs for review

**Key Methods:**
```typescript
class LoggingService {
  logAIInteraction(action, details, result): Promise<void>
  getAILogs(date: Date): Promise<AILogEntry[]>

  // Helpers
  private getOrCreateLogFile(date: Date): Promise<string>
  private appendLogEntry(fileId, entry): Promise<void>
}
```

**Log Entry Format:**
```typescript
{
  timestamp: Date,
  action: string,        // e.g., "update_repair_order"
  user: string,          // Azure AD user
  details: string,       // Command details
  result: string,        // Success/error message
  roNumber?: string      // If applicable
}
```

**File Location:** `repair-dashboard/src/lib/loggingService.ts`

---

### 6. emailTemplates.ts
**Purpose:** Generate email templates for shop communication

**Responsibilities:**
- Create quote request emails
- Create status update emails
- Create approval confirmation emails
- Populate templates with RO data

**Key Functions:**
```typescript
generateQuoteRequestEmail(ro: RepairOrder, shop: Shop): EmailTemplate
generateStatusUpdateEmail(ro: RepairOrder, shop: Shop, message: string): EmailTemplate
generateApprovalEmail(ro: RepairOrder, shop: Shop): EmailTemplate

interface EmailTemplate {
  to: string,
  subject: string,
  body: string
}
```

**File Location:** `repair-dashboard/src/lib/emailTemplates.ts`

---

### 7. trackingUtils.ts
**Purpose:** Detect carrier from tracking number and generate tracking URLs

**Responsibilities:**
- Identify carrier (UPS, FedEx, USPS, DHL) from tracking number format
- Generate tracking URLs for each carrier

**Key Functions:**
```typescript
detectCarrier(trackingNumber: string): 'UPS' | 'FedEx' | 'USPS' | 'DHL' | 'Unknown'
getTrackingUrl(trackingNumber: string): string | null
```

**File Location:** `repair-dashboard/src/lib/trackingUtils.ts`

---

### 8. exportUtils.ts
**Purpose:** Export data to CSV format

**Responsibilities:**
- Convert RO array to CSV
- Convert Shop array to CSV
- Handle special characters and commas
- Generate downloadable file

**Key Functions:**
```typescript
exportToCSV(data: RepairOrder[] | Shop[], filename: string): void
generateCSVContent(data: any[]): string
```

**File Location:** `repair-dashboard/src/lib/exportUtils.ts`

---

### 9. excelSession.ts
**Purpose:** Manage Excel workbook sessions for isolated write operations

**Responsibilities:**
- Create persistent workbook sessions
- Automatically close sessions
- Handle session timeouts
- Prevent session leaks

**Key Class:**
```typescript
class ExcelSessionManager {
  async withSession<T>(fileId: string, callback: (sessionId: string) => Promise<T>): Promise<T>
  private createSession(fileId: string): Promise<string>
  private closeSession(fileId: string, sessionId: string): Promise<void>
}
```

**File Location:** `repair-dashboard/src/lib/excelSession.ts`

---

## External Integration Services (services/)

### 1. anthropicAgent.ts
**Purpose:** Integrate with Anthropic Claude AI for natural language commands

**Responsibilities:**
- Process user commands in natural language
- Stream AI responses in real-time
- Execute tool calls (function calling)
- Maintain conversation context
- Handle errors and retries

**Key Methods:**
```typescript
class AnthropicAgent {
  processCommand(userMessage: string, context: AIContext): AsyncGenerator<string>
  continueConversation(messages: Message[]): AsyncGenerator<string>

  // Tool execution
  private executeTool(toolName: string, args: any): Promise<any>
  private buildToolSchemas(): ToolSchema[]
}
```

**AI Context Provided:**
- All active repair orders
- All shops
- User preferences
- Current date/time

**File Location:** `repair-dashboard/src/services/anthropicAgent.ts`

---

### 2. aiTools.ts
**Purpose:** Define and execute AI tools (Claude function calling)

**Responsibilities:**
- Define tool schemas for Claude
- Execute tool functions
- Validate tool arguments
- Return results to AI

**Available Tools:**
1. **update_repair_order**
   - Update status, cost, tracking, notes, dates
   - Input: roNumber, updates object
   - Output: Success message

2. **query_repair_orders**
   - Filter ROs by status, shop, date range, cost
   - Input: filters object
   - Output: Array of matching ROs

3. **send_reminder_email**
   - Send email to shop for status update
   - Input: roNumber, messageType
   - Output: Email sent confirmation

4. **get_repair_order_summary**
   - Get detailed RO information
   - Input: roNumber
   - Output: RO summary object

5. **archive_repair_order**
   - Move RO to archive sheet
   - Input: roNumber, archiveType
   - Output: Archive confirmation

**File Location:** `repair-dashboard/src/services/aiTools.ts`

---

### 3. sharePointService.ts (sharepoint.ts)
**Purpose:** Manage file attachments in SharePoint/OneDrive

**Responsibilities:**
- Upload files to RO-specific folders
- Download files
- List files for an RO
- Delete files
- Get folder URLs

**Key Methods:**
```typescript
class SharePointService {
  uploadFile(roNumber: string, file: File): Promise<Attachment>
  uploadMultipleFiles(roNumber, files: File[]): Promise<Attachment[]>
  listFiles(roNumber: string): Promise<Attachment[]>
  downloadFile(fileId: string): Promise<Blob>
  deleteFile(fileId: string): Promise<void>
  getROFolderUrl(roNumber: string): string
}
```

**Storage Modes:**
- SharePoint: Enterprise document library
- OneDrive: Personal file storage (simpler setup)

**File Location:** `repair-dashboard/src/services/sharepoint.ts`

---

### 4. inventoryService.ts
**Purpose:** Search GenThrust inventory via backend API

**Responsibilities:**
- Query backend inventory API
- Search by part number
- Return inventory items with location, qty, condition

**Key Methods:**
```typescript
class InventoryService {
  searchInventory(partNumber: string): Promise<InventoryItem[]>

  // Direct backend call
  private callBackendAPI(endpoint: string): Promise<any>
}
```

**File Location:** `repair-dashboard/src/services/inventoryService.ts`

---

### 5. aiParser.ts
**Purpose:** Parse natural language commands into structured actions (legacy)

**Note:** Largely replaced by Claude's tool use, but still used for simple command detection

**File Location:** `repair-dashboard/src/services/aiParser.ts`

---

## React Query Hooks (hooks/)

### 1. useROs.ts
**Purpose:** Data fetching and mutations for repair orders

**Hooks Exported:**
```typescript
// Queries
useROs() → { data: RepairOrder[], isLoading, error }
useArchivedROs(sheetName) → { data: RepairOrder[], isLoading, error }
useDashboardStats() → { data: DashboardStats, isLoading, error }

// Mutations
useAddRepairOrder() → mutation function
useUpdateRepairOrder() → mutation function
useUpdateROStatus() → mutation function
useBulkUpdateStatus() → mutation function
useArchiveRO() → mutation function
useDeleteRepairOrder() → mutation function
```

**Features:**
- Automatic caching (5 min stale time)
- Background refetching
- Optimistic updates
- Error handling
- Toast notifications
- Cache invalidation

**File Location:** `repair-dashboard/src/hooks/useROs.ts`

---

### 2. useShops.ts
**Purpose:** Data fetching and mutations for shop directory

**Hooks Exported:**
```typescript
// Queries
useShops() → { data: Shop[], isLoading, error }

// Mutations
useAddShop() → mutation function
useUpdateShop() → mutation function
useDeleteShop() → mutation function
```

**File Location:** `repair-dashboard/src/hooks/useShops.ts`

---

### 3. useAttachments.ts
**Purpose:** File attachment operations

**Hooks Exported:**
```typescript
useAttachments(roNumber) → { data: Attachment[], isLoading, error }
useUploadAttachment() → mutation function
useDeleteAttachment() → mutation function
```

**File Location:** `repair-dashboard/src/hooks/useAttachments.ts`

---

### 4. useInventorySearch.ts
**Purpose:** Inventory search with backend API

**Hooks Exported:**
```typescript
useInventorySearch(partNumber) → { data: InventoryItem[], isLoading, error }
```

**Features:**
- Debounced search (300ms)
- Automatic query on part number change
- Error handling

**File Location:** `repair-dashboard/src/hooks/useInventorySearch.ts`

---

### 5. useInventoryFile.ts
**Purpose:** Access GenThrust inventory Excel file metadata

**Hooks Exported:**
```typescript
useInventoryFile() → { data: FileInfo, isLoading, error }
```

**File Location:** `repair-dashboard/src/hooks/useInventoryFile.ts`

---

### 6. useROFilters.ts
**Purpose:** Client-side filtering state management

**Hook Exported:**
```typescript
useROFilters() → {
  filters: FilterState,
  setFilter: (key, value) => void,
  clearFilters: () => void,
  activeFilterCount: number
}
```

**Filter Types:**
- Search text
- Overdue only
- High value (>$5000)
- Filter by shop
- Due this week

**File Location:** `repair-dashboard/src/hooks/useROFilters.ts`

---

### 7. useAnalytics.ts
**Purpose:** Shop analytics calculations

**Hooks Exported:**
```typescript
useShopAnalytics(shopName) → { data: ShopAnalytics, isLoading }
```

**Metrics Calculated:**
- Total ROs with shop
- Average turnaround time
- Cost metrics (avg, total)
- On-time delivery rate
- Current active ROs

**File Location:** `repair-dashboard/src/hooks/useAnalytics.ts`

---

## UI Components (components/)

### Major Components

1. **Dashboard.tsx** - Main dashboard with KPI cards and RO table
2. **ROTable.tsx** - Repair orders table with sorting, filtering, pagination
3. **RODetailDialog.tsx** - Detailed RO view with tabs
4. **AddRODialog.tsx** - Create/edit RO form
5. **UpdateStatusDialog.tsx** - Status update with archival logic
6. **ShopDirectory.tsx** - Shop management interface
7. **ShopManagementDialog.tsx** - Add/edit shop form
8. **AIAgentDialog.tsx** - AI assistant chat interface
9. **EmailComposerDialog.tsx** - Email composition
10. **AttachmentManager.tsx** - File upload/download interface
11. **StatusTimeline.tsx** - Visual status history
12. **InventorySearchTab.tsx** - Inventory search UI
13. **ShopAnalyticsTab.tsx** - Shop performance metrics

See `view.md` for detailed component documentation.

---

## Configuration (config/)

### 1. anthropic.ts
**Purpose:** Anthropic AI configuration

**Exports:**
```typescript
export const ANTHROPIC_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  temperature: 0.7
}
```

**File Location:** `repair-dashboard/src/config/anthropic.ts`

---

### 2. excelSheets.ts
**Purpose:** Excel table and column mappings

**Exports:**
```typescript
export const EXCEL_TABLES = {
  ACTIVE: 'RepairTable',
  PAID: 'Paid',
  NET: 'NET',
  RETURNS: 'Returns',
  SHOPS: 'ShopsTable'
}

export const COLUMN_MAPPINGS = {
  RO_NUMBER: 0,
  DATE_MADE: 1,
  SHOP_NAME: 2,
  // ... full mapping
}
```

**File Location:** `repair-dashboard/src/config/excelSheets.ts`

---

### 3. sharepoint.ts
**Purpose:** SharePoint/OneDrive storage configuration

**Exports:**
```typescript
export const STORAGE_CONFIG = {
  type: 'sharepoint' | 'onedrive',
  siteId: string,
  driveId: string
}
```

**File Location:** `repair-dashboard/src/config/sharepoint.ts`

---

## Utilities (utils/)

### logger.ts
**Purpose:** Winston logger factory

**Exports:**
```typescript
export const createLogger = (moduleName: string): Logger
```

**Log Levels:**
- error
- warn
- info
- debug

**File Location:** `repair-dashboard/src/utils/logger.ts`

---

## Backend Modules (backend/)

### API Routes (routes/)

#### 1. inventory.js
**Purpose:** Inventory search API

**Endpoints:**
```
GET /api/inventory/search?partNumber=XXX
```

**Response:**
```json
[
  {
    "indexId": 1,
    "partNumber": "123-456",
    "tableName": "stock_room",
    "serialNumber": "ABC123",
    "qty": 5,
    "condition": "OH",
    "location": "BIN-A1",
    "description": "Part description"
  }
]
```

**Search Strategy:**
1. Exact match in inventoryindex
2. LIKE search in inventoryindex
3. Direct search in inventory tables (stock_room, bins_inventory, etc.)

**File Location:** `backend/routes/inventory.js`

---

#### 2. ai.js
**Purpose:** Anthropic AI proxy (optional - avoids exposing API key in frontend)

**Endpoints:**
```
POST /api/ai/chat
```

**Request Body:**
```json
{
  "messages": [...],
  "tools": [...]
}
```

**Response:** Streaming AI response

**File Location:** `backend/routes/ai.js`

---

#### 3. ai-logs.js
**Purpose:** AI logging endpoints (if needed for backend logging)

**File Location:** `backend/routes/ai-logs.js`

---

### Database Configuration (config/)

#### database.js
**Purpose:** MySQL connection pool configuration

**Exports:**
```javascript
export const inventoryPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});
```

**File Location:** `backend/config/database.js`

---

## Module Dependencies

### Dependency Graph

```
Components
  └─> Hooks
      └─> Services (lib/ & services/)
          └─> Microsoft Graph API
          └─> Anthropic API
          └─> Backend API
              └─> MySQL Database

MSAL (shared across all services that need auth)
```

### Circular Dependency Prevention

**Rules:**
- Hooks can call services, but services cannot call hooks
- Components can call hooks, but hooks cannot import components
- Services can call other services, but use dependency injection when possible
- Config files are leaf nodes (no dependencies except env vars)

---

## Testing Modules

### Test Files Pattern
- `*.test.ts` - Unit tests for services/utilities
- `*.test.tsx` - Component tests

### Test Coverage
- Business logic: businessRules.test.ts
- Excel operations: excelSession.test.ts
- Email generation: emailTemplates.test.ts
- React hooks: useROs.test.tsx, useShops.test.tsx
- UI components: ROTable.test.tsx, etc.

---

## Module Versioning

### When to Create a New Module
- Distinct responsibility (Single Responsibility Principle)
- Reusable across multiple components
- Clear, focused API
- Can be tested in isolation

### When to Refactor a Module
- Module exceeds 500 lines
- Too many responsibilities
- Difficult to test
- Circular dependencies detected

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
