# data_models.md - Data Models & Type Definitions

## Purpose
This document defines all data structures, TypeScript interfaces, and database schemas used in the GenThrust RO Tracker.

---

## TypeScript Interfaces

### Core Data Models

#### RepairOrder
**Purpose:** Represents a single repair order (RO) for an aircraft part.

**Definition:**
```typescript
export interface RepairOrder {
  // Identifiers
  id: string;                        // Generated: "row-{index}"
  roNumber: string;                  // e.g., "RO-12345"

  // Dates
  dateMade: Date | null;             // When RO was created
  dateDroppedOff: Date | null;       // When part sent to shop
  estimatedDeliveryDate: Date | null;// Expected return date
  currentStatusDate: Date | null;    // When current status was set
  lastDateUpdated: Date | null;      // Last time RO was modified
  nextDateToUpdate: Date | null;     // When to follow up next

  // Shop & Part Info
  shopName: string;                  // Repair facility name
  partNumber: string;                // Manufacturer part number
  serialNumber: string;              // Part serial number
  partDescription: string;           // What the part is
  requiredWork: string;              // Work to be done
  shopReferenceNumber: string;       // Shop's internal RO number

  // Costs
  estimatedCost: number | null;      // Quote from shop
  finalCost: number | null;          // Actual final cost
  terms: string;                     // Payment terms (NET 30, COD, etc.)

  // Status
  currentStatus: string;             // Current status (see Status enum)
  genThrustStatus: string;           // Internal status (optional)
  shopStatus: string;                // Status from shop (optional)
  trackingNumber: string;            // Shipping tracking number

  // Notes & History
  notes: string;                     // Freeform notes
  statusHistory: StatusHistoryEntry[]; // All status changes

  // Computed Fields
  daysOverdue: number;               // Days past nextDateToUpdate
  isOverdue: boolean;                // true if past nextDateToUpdate
  checked?: boolean;                 // Checkbox state (UI only)
}
```

**Excel Column Mapping:**
```typescript
// Column index → Field mapping (0-based)
0  → roNumber
1  → dateMade
2  → shopName
3  → partNumber
4  → serialNumber
5  → partDescription
6  → requiredWork
7  → dateDroppedOff
8  → estimatedCost
9  → finalCost
10 → terms
11 → shopReferenceNumber
12 → estimatedDeliveryDate
13 → currentStatus
14 → currentStatusDate
15 → genThrustStatus
16 → shopStatus
17 → trackingNumber
18 → notes
19 → lastDateUpdated
20 → nextDateToUpdate
21 → checked
```

**File Location:** `src/types/index.ts:10-40`

---

#### StatusHistoryEntry
**Purpose:** Records a single status change event.

**Definition:**
```typescript
export interface StatusHistoryEntry {
  status: string;           // Status at this point (e.g., "APPROVED")
  date: Date;               // When status changed
  user: string;             // Azure AD user email
  cost?: number;            // Cost if updated with status change
  notes?: string;           // Optional notes for this change
  deliveryDate?: Date;      // Delivery date if updated
}
```

**Storage:** Stored as JSON string in Excel `notes` column or separate column.

**File Location:** `src/types/index.ts:1-8`

---

#### Shop
**Purpose:** Represents a repair facility or vendor.

**Definition:**
```typescript
export interface Shop {
  // Identifiers
  id: string;                 // Generated: "row-{index}"
  customerNumber: string;     // Internal customer ID

  // Business Info
  businessName: string;       // Legal business name

  // Address
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  city: string;
  state: string;
  zip: string;
  country: string;

  // Contact
  phone: string;
  tollFree: string;
  fax: string;
  email: string;
  website: string;
  contact: string;            // Primary contact person name

  // Business Details
  paymentTerms: string;       // Default payment terms
  ilsCode: string;            // ILS (Integrated Logistics Support) code
  lastSaleDate: Date | null;  // Most recent transaction
  ytdSales: number | null;    // Year-to-date sales

  // Computed/Alias Fields (backward compatibility)
  shopName: string;           // Alias for businessName
  contactName: string;        // Alias for contact
  defaultTerms: string;       // Alias for paymentTerms
}
```

**Excel Column Mapping:**
```typescript
// Column index → Field mapping
0  → customerNumber
1  → businessName
2  → addressLine1
3  → addressLine2
4  → addressLine3
5  → addressLine4
6  → city
7  → state
8  → zip
9  → country
10 → phone
11 → tollFree
12 → fax
13 → email
14 → website
15 → contact
16 → paymentTerms
17 → ilsCode
18 → lastSaleDate
19 → ytdSales
```

**File Location:** `src/types/index.ts:62-90`

---

#### DashboardStats
**Purpose:** Calculated statistics for dashboard KPIs.

**Definition:**
```typescript
export interface DashboardStats {
  // Active RO Metrics
  totalActive: number;          // Count of active ROs
  overdue: number;              // Count overdue
  waitingQuote: number;         // Count in WAITING QUOTE
  approved: number;             // Count in APPROVED
  beingRepaired: number;        // Count in BEING REPAIRED
  shipping: number;             // Count in SHIPPING/CURRENTLY BEING SHIPPED
  dueToday: number;             // Count due today
  overdue30Plus: number;        // Overdue by 30+ days
  onTrack: number;              // Not overdue

  // Financial
  totalValue: number;           // Sum of all finalCost (all ROs)
  totalEstimatedValue: number;  // Sum of all estimatedCost
  totalFinalValue: number;      // Sum of finalCost (completed only)

  // Archive Stats
  approvedPaid: number;         // Count in PAID sheet
  approvedNet: number;          // Count in NET sheet
  rai: number;                  // Count in Returns (RAI)
  ber: number;                  // Count in Returns (BER)
  cancel: number;               // Count in Returns (Cancelled)
  scrapped: number;             // Count in Returns (SCRAPPED)
}
```

**Calculation:** Computed in real-time from RO array (not stored).

**File Location:** `src/types/index.ts:41-61`

---

#### Attachment
**Purpose:** Represents a file attachment for an RO.

**Definition:**
```typescript
export interface Attachment {
  id: string;                   // SharePoint/OneDrive file ID
  name: string;                 // File name
  size: number;                 // File size in bytes
  mimeType: string;             // MIME type (e.g., "application/pdf")
  webUrl: string;               // URL to open in browser
  downloadUrl: string;          // Direct download URL
  createdDateTime: Date;        // Upload date
  createdBy: {
    user: {
      displayName: string;
      email: string;
    };
  };
  lastModifiedDateTime: Date;
  lastModifiedBy: {
    user: {
      displayName: string;
      email: string;
    };
  };
}
```

**File Location:** `src/types/index.ts:91-112`

---

#### InventoryItem
**Purpose:** Represents a single inventory part from MySQL database.

**Definition:**
```typescript
export interface InventoryItem {
  indexId: number | null;       // Primary key in inventoryindex
  partNumber: string;           // Part number
  tableName: string;            // Source table (stock_room, bins_inventory, etc.)
  rowId: number | null;         // Row ID in source table
  serialNumber: string | null;  // Serial number (if tracked)
  qty: number;                  // Quantity available
  condition: string;            // OH (Overhauled), SV (Serviceable), etc.
  location: string;             // BIN-A1, SHELF-5, etc.
  description: string;          // Part description
  lastSeen: Date | null;        // Last indexed/updated date
}
```

**File Location:** `src/types/aiCommand.ts` (or types/index.ts)

---

### AI-Related Models

#### AIContext
**Purpose:** Context provided to Claude AI for processing commands.

**Definition:**
```typescript
export interface AIContext {
  repairOrders: RepairOrder[];  // All active ROs
  shops: Shop[];                // All shops
  currentUser: {
    name: string;
    email: string;
  };
  currentDate: Date;
}
```

**Usage:** Sent to AI with each command for context awareness.

**File Location:** `src/services/aiTools.ts`

---

#### AILogEntry
**Purpose:** Log entry for AI interactions.

**Definition:**
```typescript
export interface AILogEntry {
  timestamp: Date;
  action: string;               // e.g., "update_repair_order"
  user: string;                 // Azure AD email
  details: string;              // Command text or action details
  result: string;               // Success/error message
  roNumber?: string;            // If action was on specific RO
}
```

**Storage:** Logged to daily Excel files in SharePoint/OneDrive.

**File Location:** `src/lib/loggingService.ts`

---

### Analytics Models

#### ShopAnalytics
**Purpose:** Performance metrics for a single shop.

**Definition:**
```typescript
export interface ShopAnalytics {
  shopName: string;

  // Volume
  totalROs: number;
  activeROs: number;
  completedROs: number;

  // Performance
  avgTurnaroundDays: number;    // Avg from TO SEND to RECEIVED
  onTimeDeliveryRate: number;   // % delivered by estimated date

  // Financial
  totalSpent: number;           // Sum of all finalCost
  avgCostPerRO: number;         // Average repair cost
  minCost: number;
  maxCost: number;

  // Quality
  berRate: number;              // % of ROs that were BER
  raiRate: number;              // % of ROs that were RAI
  successRate: number;          // % completed successfully

  // Recent Activity
  lastRODate: Date | null;      // Most recent RO date
  recentROCount30Days: number;  // ROs in last 30 days
}
```

**Calculation:** Computed in useAnalytics hook.

**File Location:** `src/hooks/useAnalytics.ts`

---

## Enums & Constants

### Status Values

**RO Status (currentStatus):**
```typescript
export const RO_STATUSES = [
  'TO SEND',                    // Part not yet sent to shop
  'WAITING QUOTE',              // Awaiting quote from shop
  'APPROVED >>>>',              // Quote approved, proceed with repair
  'BEING REPAIRED',             // Repair in progress
  'CURRENTLY BEING SHIPPED',    // Shipping TO shop
  'RECEIVED',                   // Received back from shop
  'SHIPPING',                   // Shipping TO customer
  'PAID >>>>',                  // Paid, completed
  'PAYMENT SENT',               // Payment processed
  'BER',                        // Beyond Economic Repair
  'RAI'                         // Return As-Is
] as const;

export type ROStatus = typeof RO_STATUSES[number];
```

**File Location:** `src/config/excelSheets.ts`

---

### Payment Terms

**Common Terms:**
```typescript
export const PAYMENT_TERMS = [
  'NET 30',
  'NET 60',
  'NET 90',
  'COD',         // Cash on Delivery
  'Prepaid',
  'Credit Card',
  'Wire Transfer',
  'Check',
  'Due on Receipt'
] as const;
```

---

### Archive Sheets

**Sheet Names:**
```typescript
export const ARCHIVE_SHEETS = {
  PAID: 'Paid',       // Completed & paid ROs
  NET: 'NET',         // Received, awaiting NET payment
  RETURNS: 'Returns'  // BER, RAI, Cancelled
} as const;
```

**File Location:** `src/config/excelSheets.ts`

---

## Database Schemas (MySQL)

### inventoryindex Table

**Purpose:** Master search index for all inventory items.

**Schema:**
```sql
CREATE TABLE inventoryindex (
  IndexId INT AUTO_INCREMENT PRIMARY KEY,
  PartNumber VARCHAR(100) NOT NULL,
  TableName VARCHAR(50),           -- Source table (stock_room, bins_inventory, etc.)
  RowId INT,                        -- Row ID in source table
  SerialNumber VARCHAR(100),
  Qty INT,
  `Condition` VARCHAR(20),          -- OH, SV, AR, etc.
  Location VARCHAR(100),            -- BIN-A1, SHELF-5, etc.
  Description TEXT,
  LastSeen DATETIME,                -- Last indexed/updated

  INDEX idx_partNumber (PartNumber),
  FULLTEXT idx_description (Description)
);
```

**Data Sources:** Indexed from stock_room, bins_inventory, receiving, etc.

**File Location:** `backend/setup_databases.sql`

---

### stock_room Table (Example Source Table)

**Schema:**
```sql
CREATE TABLE stock_room (
  RowId INT AUTO_INCREMENT PRIMARY KEY,
  PN VARCHAR(100),                  -- Part Number
  SERIAL VARCHAR(100),
  QTY INT,
  COND VARCHAR(20),                 -- Condition
  LOCATION VARCHAR(100),
  DESCRIPTION TEXT,
  TAG_DATE DATE,
  -- ... other fields
);
```

---

### bins_inventory Table (Example Source Table)

**Schema:**
```sql
CREATE TABLE bins_inventory (
  RowId INT AUTO_INCREMENT PRIMARY KEY,
  PN VARCHAR(100),
  SERIAL VARCHAR(100),
  QTY INT,
  `CONDITION` VARCHAR(20),
  LOCATION VARCHAR(100),
  DESCRIPTION TEXT,
  TAG_DATE DATE,
  -- ... other fields
);
```

---

## Validation Rules

### RepairOrder Validation

**Required Fields:**
- `roNumber` - Cannot be empty
- `shopName` - Must match existing shop (or be manually entered)
- `partDescription` - Cannot be empty

**Optional Fields (can be null/empty):**
- `serialNumber`
- `partNumber`
- `requiredWork`
- `estimatedCost`
- `finalCost`
- `terms`
- `trackingNumber`
- All dates

**Business Rules:**
- `finalCost` should not exceed `estimatedCost` by >50% (warning, not error)
- `nextDateToUpdate` should be in the future (calculated automatically)
- `daysOverdue` >= 0 if `isOverdue` = true

---

### Shop Validation

**Required Fields:**
- `businessName` - Cannot be empty
- `email` - Must be valid email format
- `paymentTerms` - Should be one of the standard terms (or freeform)

**Optional Fields:**
- All address fields
- Phone numbers
- Contact name
- Customer number

---

## Data Transformations

### Excel to TypeScript

**Date Conversion:**
```typescript
// Excel serial (e.g., 45678) → JavaScript Date
const parseExcelDate = (serial: number): Date => {
  return new Date((serial - 25569) * 86400 * 1000);
};
```

**Currency Conversion:**
```typescript
// Excel number/string → number
const parseCurrency = (value: any): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '');
    return parseFloat(cleaned);
  }
  return null;
};
```

---

### TypeScript to Excel

**Date Conversion:**
```typescript
// JavaScript Date → Excel serial
const formatExcelDate = (date: Date): number => {
  return Math.floor(date.getTime() / 86400 / 1000) + 25569;
};
```

**Currency Conversion:**
```typescript
// number → Excel number (no formatting needed)
const formatCurrency = (amount: number): number => amount;
```

---

## API Response Types

### Graph API Responses

**Get Table Rows Response:**
```typescript
interface GraphTableRowsResponse {
  value: {
    index: number;
    values: any[][];  // 2D array: [row][column]
  }[];
}
```

**Get File Response:**
```typescript
interface GraphFileResponse {
  id: string;
  name: string;
  size: number;
  file: {
    mimeType: string;
  };
  webUrl: string;
  '@microsoft.graph.downloadUrl': string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy: { user: { displayName: string; email: string; } };
  lastModifiedBy: { user: { displayName: string; email: string; } };
}
```

---

### Backend API Responses

**Inventory Search Response:**
```typescript
interface InventorySearchResponse {
  results: InventoryItem[];
  total: number;
  query: string;
}
```

**AI Proxy Response:**
```typescript
interface AIProxyResponse {
  response: string;      // AI text response
  toolCalls?: {          // If tools were used
    name: string;
    args: any;
    result: any;
  }[];
}
```

---

## React Query Cache Keys

**Naming Convention:**
```typescript
// Format: [entity, ...identifiers]

// Repair Orders
['ros']                          // All active ROs
['ros', 'archived', 'PAID']      // Archived ROs (PAID sheet)
['ros', 'archived', 'NET']       // Archived ROs (NET sheet)
['ros', 'archived', 'Returns']   // Archived ROs (Returns sheet)
['dashboard-stats']              // Dashboard KPIs

// Shops
['shops']                        // All shops

// Attachments
['attachments', roNumber]        // Files for specific RO

// Inventory
['inventory', 'search', partNumber]  // Search results

// AI Logs
['ai-logs', date.toISOString()]  // Logs for specific date
```

---

## Type Utilities

### Partial Types

**Create/Update DTO:**
```typescript
type CreateROData = Partial<RepairOrder> & {
  roNumber: string;        // Required
  shopName: string;        // Required
  partDescription: string; // Required
};
```

### Pick/Omit Types

**For API responses:**
```typescript
// Exclude computed fields
type ROStorageData = Omit<RepairOrder, 'id' | 'daysOverdue' | 'isOverdue' | 'checked'>;

// Only display fields
type ROTableRow = Pick<RepairOrder, 'roNumber' | 'shopName' | 'currentStatus' | 'nextDateToUpdate' | 'finalCost' | 'isOverdue'>;
```

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
