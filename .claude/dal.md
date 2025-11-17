# dal.md - Data Access Layer Documentation

## Purpose
This document describes how the GenThrust RO Tracker accesses, reads, writes, and manages data across different storage systems (SharePoint Excel, MySQL, OneDrive/SharePoint files).

---

## Data Access Architecture

```
┌────────────────────────────────────────────────────────────┐
│              DATA ACCESS LAYER                              │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Excel Service       →  Microsoft Graph API  → SharePoint  │
│  Shop Service        →  Microsoft Graph API  → SharePoint  │
│  Reminder Service    →  Microsoft Graph API  → To Do/Cal   │
│  SharePoint Service  →  Microsoft Graph API  → OneDrive    │
│  Inventory Service   →  Backend API         → MySQL        │
│  Logging Service     →  Microsoft Graph API  → OneDrive    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Microsoft Graph API Data Access

### Authentication

**MSAL Token Acquisition:**
```typescript
private async getAccessToken(): Promise<string> {
  const account = this.msalInstance.getAllAccounts()[0];

  try {
    // Try silent acquisition first (uses cached/refreshed token)
    const response = await this.msalInstance.acquireTokenSilent({
      scopes: ['User.Read', 'Files.ReadWrite.All', 'Sites.Read.All'],
      account
    });
    return response.accessToken;
  } catch (silentError) {
    // Silent failed, try popup
    try {
      const response = await this.msalInstance.acquireTokenPopup({...});
      return response.accessToken;
    } catch (popupError) {
      // Popup failed (CORS/COOP), use redirect
      await this.msalInstance.acquireTokenRedirect({...});
      throw new Error("Redirecting for authentication...");
    }
  }
}
```

**Token Lifecycle:**
- Access Token: Valid for 1 hour
- Refresh Token: Valid for 90 days
- Automatic refresh via `acquireTokenSilent`
- Fallback flows: Silent → Popup → Redirect

**File Location:** `excelService.ts:25-62`

---

### SharePoint File Discovery

**Finding Excel Files:**

```typescript
async getFileId(): Promise<string> {
  // Step 1: Get SharePoint site ID
  const sitePath = new URL(SITE_URL).pathname;
  const siteResponse = await this.callGraphAPI(
    `https://graph.microsoft.com/v1.0/sites/root:${sitePath}`
  );

  // Step 2: Get site drive
  const driveResponse = await this.callGraphAPI(
    `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
  );

  // Step 3: Search for file by name
  const searchResponse = await this.callGraphAPI(
    `https://graph.microsoft.com/v1.0/drives/${driveResponse.id}/root/search(q='${FILE_NAME}')`
  );

  if (searchResponse.value.length === 0) {
    throw new Error(`File ${FILE_NAME} not found`);
  }

  return searchResponse.value[0].id;  // File ID (used for subsequent operations)
}
```

**Caching Strategy:**
- File ID cached in memory (service instance)
- Drive ID cached in memory
- Re-fetched only on service restart or error

**File Location:** `excelService.ts:115-145`

---

### Excel Table Operations

#### Read Operations

**Get All Rows from Table:**
```typescript
async getRepairOrders(): Promise<RepairOrder[]> {
  const fileId = await this.getFileId();

  // GET request to Excel table rows endpoint
  const response = await this.callGraphAPI(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows`
  );

  // Parse each row
  return response.value.map((row, index) => {
    const values = row.values[0];  // First array contains row data

    return {
      id: `row-${index}`,
      roNumber: values[0],
      dateMade: this.parseExcelDate(values[1]),
      shopName: values[2],
      // ... parse all 22 columns
    };
  });
}
```

**Response Structure:**
```json
{
  "value": [
    {
      "index": 0,
      "values": [
        ["RO-12345", 45678, "Duncan Aviation", "123-456", ...]
      ]
    },
    ...
  ]
}
```

**File Location:** `excelService.ts:245-295`

---

#### Write Operations

**Update Entire Row:**
```typescript
async updateRepairOrder(rowIndex: number, data: Partial<RepairOrder>): Promise<void> {
  const fileId = await this.getFileId();

  // Create workbook session for isolated write
  const sessionId = await this.sessionManager.createSession(fileId);

  try {
    // Get current row data
    const currentRow = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      'GET',
      null,
      sessionId
    );

    // Merge updates with current data
    const updatedValues = [...currentRow.values[0]];
    if (data.currentStatus) updatedValues[13] = data.currentStatus;
    if (data.notes) updatedValues[18] = data.notes;
    // ... update other fields

    // PATCH request to update row
    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      'PATCH',
      { values: [updatedValues] },
      sessionId
    );
  } finally {
    // Always close session
    await this.sessionManager.closeSession(fileId, sessionId);
  }
}
```

**File Location:** `excelService.ts:350-410`

---

**Add New Row:**
```typescript
async addRepairOrder(data: Partial<RepairOrder>): Promise<void> {
  const fileId = await this.getFileId();
  const sessionId = await this.sessionManager.createSession(fileId);

  try {
    // Build row values array (22 columns)
    const newRow = [
      data.roNumber,
      this.formatExcelDate(data.dateMade),
      data.shopName,
      // ... all 22 columns
    ];

    // POST request to add row
    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows`,
      'POST',
      { values: [newRow] },
      sessionId
    );
  } finally {
    await this.sessionManager.closeSession(fileId, sessionId);
  }
}
```

**File Location:** `excelService.ts:295-350`

---

**Delete Row:**
```typescript
async deleteRepairOrder(rowIndex: number): Promise<void> {
  const fileId = await this.getFileId();
  const sessionId = await this.sessionManager.createSession(fileId);

  try {
    // DELETE request
    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      'DELETE',
      null,
      sessionId
    );
  } finally {
    await this.sessionManager.closeSession(fileId, sessionId);
  }
}
```

**File Location:** `excelService.ts:520-545`

---

### Workbook Session Management

**Purpose:** Isolate write operations to prevent conflicts with concurrent users.

**Session Lifecycle:**
```typescript
class ExcelSessionManager {
  async withSession<T>(
    fileId: string,
    callback: (sessionId: string) => Promise<T>
  ): Promise<T> {
    // 1. Create session
    const sessionId = await this.createSession(fileId);

    try {
      // 2. Execute operation with session ID
      const result = await callback(sessionId);
      return result;
    } finally {
      // 3. Always close session (even if operation fails)
      await this.closeSession(fileId, sessionId);
    }
  }

  private async createSession(fileId: string): Promise<string> {
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/createSession`,
      'POST',
      { persistChanges: true }
    );
    return response.id;
  }

  private async closeSession(fileId: string, sessionId: string): Promise<void> {
    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/closeSession`,
      'POST',
      null,
      sessionId
    );
  }
}
```

**Why Sessions?**
- Prevents conflicts when multiple users edit simultaneously
- Ensures data consistency
- Recommended by Microsoft for all write operations
- Automatically handles locking

**File Location:** `excelSession.ts`

---

### Excel Data Type Conversion

**Date Conversion:**
```typescript
private parseExcelDate(value: any): Date | null {
  if (!value) return null;

  // Excel stores dates as serial numbers (days since 1900-01-01)
  if (typeof value === 'number') {
    // Formula: (serial - 25569) * 86400 * 1000
    // 25569 = days between 1900-01-01 and 1970-01-01
    // 86400 = seconds per day
    // 1000 = milliseconds per second
    return new Date((value - 25569) * 86400 * 1000);
  }

  // ISO string (from Graph API sometimes)
  if (typeof value === 'string') {
    return new Date(value);
  }

  return null;
}

private formatExcelDate(date: Date | null): number | null {
  if (!date) return null;

  // Convert JavaScript Date to Excel serial number
  return Math.floor(date.getTime() / 86400 / 1000) + 25569;
}
```

**Currency Conversion:**
```typescript
private parseCurrency(value: any): number | null {
  if (!value) return null;

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // Remove $, commas
    const cleaned = value.replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}
```

**File Location:** `excelService.ts:150-200`

---

## File Storage Data Access (SharePoint/OneDrive)

### File Upload

**Upload Single File:**
```typescript
async uploadFile(roNumber: string, file: File): Promise<Attachment> {
  const token = await this.getAccessToken();

  // Create folder for RO if it doesn't exist
  const folderPath = `RO Attachments/${roNumber}`;
  await this.ensureFolderExists(folderPath);

  // Upload file
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${file.name}:/content`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': file.type
    },
    body: file
  });

  const fileData = await response.json();

  return {
    id: fileData.id,
    name: fileData.name,
    size: fileData.size,
    mimeType: fileData.file.mimeType,
    webUrl: fileData.webUrl,
    downloadUrl: fileData['@microsoft.graph.downloadUrl'],
    createdDateTime: new Date(fileData.createdDateTime),
    // ... metadata
  };
}
```

**File Location:** `services/sharepoint.ts`

---

### File Download

**Download File as Blob:**
```typescript
async downloadFile(fileId: string): Promise<Blob> {
  const token = await this.getAccessToken();

  // Get download URL
  const fileResponse = await this.callGraphAPI(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`
  );

  const downloadUrl = fileResponse['@microsoft.graph.downloadUrl'];

  // Download file content
  const response = await fetch(downloadUrl);
  return await response.blob();
}
```

---

### File Listing

**List Files in RO Folder:**
```typescript
async listFiles(roNumber: string): Promise<Attachment[]> {
  const folderPath = `RO Attachments/${roNumber}`;

  try {
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}:/children`
    );

    return response.value.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.file.mimeType,
      webUrl: file.webUrl,
      downloadUrl: file['@microsoft.graph.downloadUrl'],
      createdDateTime: new Date(file.createdDateTime),
      lastModifiedDateTime: new Date(file.lastModifiedDateTime),
      createdBy: file.createdBy,
      lastModifiedBy: file.lastModifiedBy
    }));
  } catch (error) {
    // Folder doesn't exist
    if (error.status === 404) {
      return [];
    }
    throw error;
  }
}
```

**File Location:** `services/sharepoint.ts`

---

## MySQL Database Data Access (Inventory)

### Connection Pool

**Configuration:**
```javascript
// backend/config/database.js
import mysql from 'mysql2/promise';

export const inventoryPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'genthrust_inventory',
  connectionLimit: 10,           // Max concurrent connections
  queueLimit: 0,                 // No limit on queued requests
  waitForConnections: true,      // Wait if all connections busy
  enableKeepAlive: true,         // Keep connections alive
  keepAliveInitialDelay: 0
});
```

**Why Pooling?**
- Reuse connections (avoid overhead of creating new connections)
- Better performance under load
- Automatic reconnection on failure

**File Location:** `backend/config/database.js`

---

### Inventory Search Queries

**Search Strategy: Three-tier approach**

**Tier 1: Exact Match in Index**
```javascript
const [rows] = await db.query(
  `SELECT
    IndexId as indexId,
    PartNumber as partNumber,
    TableName as tableName,
    RowId as rowId,
    SerialNumber as serialNumber,
    Qty as qty,
    \`Condition\` as \`condition\`,
    Location as location,
    Description as description,
    LastSeen as lastSeen
  FROM inventoryindex
  WHERE UPPER(TRIM(PartNumber)) = ?`,
  [normalizedPartNumber]
);
```

**Tier 2: LIKE Search in Index**
```javascript
if (rows.length === 0) {
  const [rows] = await db.query(
    `SELECT ...
    FROM inventoryindex
    WHERE UPPER(TRIM(PartNumber)) LIKE ?
    LIMIT 50`,
    [`%${normalizedPartNumber}%`]
  );
}
```

**Tier 3: Direct Table Search**
```javascript
if (rows.length === 0) {
  // Search stock_room
  const [stockRoomRows] = await db.query(
    `SELECT
      NULL as indexId,
      PN as partNumber,
      'stock_room' as tableName,
      NULL as rowId,
      SERIAL as serialNumber,
      QTY as qty,
      COND as \`condition\`,
      LOCATION as location,
      DESCRIPTION as description,
      TAG_DATE as lastSeen
    FROM stock_room
    WHERE UPPER(TRIM(PN)) = ? OR UPPER(TRIM(PN)) LIKE ?
    LIMIT 25`,
    [normalizedPartNumber, `%${normalizedPartNumber}%`]
  );

  // Search bins_inventory
  const [binsRows] = await db.query(...);

  // Combine results
  rows = [...stockRoomRows, ...binsRows];
}
```

**Why This Strategy?**
1. Fast exact match on indexed column
2. Fallback to partial match if exact not found
3. Last resort: search original tables directly
4. Limit results to prevent overwhelming response

**File Location:** `backend/routes/inventory.js:10-120`

---

### Database Schema

**inventoryindex Table:**
```sql
CREATE TABLE inventoryindex (
  IndexId INT AUTO_INCREMENT PRIMARY KEY,
  PartNumber VARCHAR(100) NOT NULL,
  TableName VARCHAR(50),           -- Source table name
  RowId INT,                        -- Row ID in source table
  SerialNumber VARCHAR(100),
  Qty INT,
  `Condition` VARCHAR(20),          -- OH, SV, etc.
  Location VARCHAR(100),            -- BIN-A1, etc.
  Description TEXT,
  LastSeen DATETIME,                -- Last indexed date
  INDEX idx_partNumber (PartNumber),
  FULLTEXT idx_description (Description)
);
```

**Why an Index Table?**
- Consolidates data from multiple tables (stock_room, bins_inventory, receiving, etc.)
- Faster searches (single table query)
- Uniform data structure
- Pre-processed and cleaned data

---

## Microsoft To Do & Calendar Data Access

### Create To Do Task

**API Call:**
```typescript
async createToDoTask(title: string, dueDate: Date, notes?: string): Promise<void> {
  const token = await this.getAccessToken();

  // Get or create default task list
  const listId = await this.getDefaultTaskList();

  // Create task
  await this.callGraphAPI(
    `https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`,
    'POST',
    {
      title: title,
      body: {
        content: notes || '',
        contentType: 'text'
      },
      dueDateTime: {
        dateTime: dueDate.toISOString(),
        timeZone: 'UTC'
      },
      importance: 'normal'
    }
  );
}
```

**File Location:** `lib/reminderService.ts:45-80`

---

### Create Calendar Event

**API Call:**
```typescript
async createCalendarEvent(title: string, startDate: Date, notes?: string): Promise<void> {
  const token = await this.getAccessToken();

  await this.callGraphAPI(
    `https://graph.microsoft.com/v1.0/me/calendar/events`,
    'POST',
    {
      subject: title,
      body: {
        contentType: 'text',
        content: notes || ''
      },
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
        timeZone: 'UTC'
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: 1440  // 1 day before
    }
  );
}
```

**File Location:** `lib/reminderService.ts:120-160`

---

## Caching Strategy

### React Query Cache

**Configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // Data fresh for 5 minutes
      cacheTime: 10 * 60 * 1000,     // Cache retained for 10 minutes
      refetchOnWindowFocus: true,    // Refetch when user returns to tab
      refetchInterval: 60 * 1000,    // Auto-refetch every minute
      retry: 3,                       // Retry failed requests 3 times
    }
  }
});
```

**Cache Keys:**
```typescript
// Repair Orders
['ros']                           // All active ROs
['ros', 'archived', 'PAID']       // Archived (PAID sheet)
['ros', 'archived', 'NET']        // Archived (NET sheet)
['ros', 'archived', 'Returns']    // Archived (Returns sheet)

// Shops
['shops']                         // All shops

// Attachments
['attachments', roNumber]         // Files for specific RO

// Inventory
['inventory', partNumber]         // Search results for part

// Dashboard
['dashboard-stats']               // KPI calculations
```

**Cache Invalidation:**
```typescript
// After mutation
queryClient.invalidateQueries({ queryKey: ['ros'] });
queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

// Specific invalidation
queryClient.invalidateQueries({ queryKey: ['attachments', roNumber] });
```

---

## Error Handling

### Graph API Errors

**Common Errors:**

1. **401 Unauthorized**
   - Token expired
   - **Fix:** Refresh token via `acquireTokenSilent`

2. **403 Forbidden**
   - Insufficient permissions
   - **Fix:** Request additional scopes

3. **404 Not Found**
   - File/table doesn't exist
   - **Fix:** Verify file name and table name

4. **429 Too Many Requests**
   - Rate limit exceeded
   - **Fix:** Implement exponential backoff

5. **500 Internal Server Error**
   - SharePoint service issue
   - **Fix:** Retry after delay

**Error Handling Pattern:**
```typescript
try {
  const result = await this.callGraphAPI(endpoint, method, body);
  return result;
} catch (error: any) {
  if (error.status === 401) {
    // Token refresh already attempted in getAccessToken
    throw new Error('Authentication failed. Please log in again.');
  } else if (error.status === 404) {
    throw new Error('Resource not found. Check file/table names.');
  } else if (error.status === 429) {
    // Rate limited - wait and retry
    await sleep(5000);
    return await this.callGraphAPI(endpoint, method, body);
  } else {
    // Generic error
    throw new Error(`API error: ${error.message}`);
  }
}
```

---

### Database Errors

**Connection Error:**
```javascript
try {
  const [rows] = await db.query(sql, params);
  return rows;
} catch (error) {
  console.error('[Database Error]:', error);

  if (error.code === 'ECONNREFUSED') {
    throw new Error('Database connection refused. Is MySQL running?');
  } else if (error.code === 'ER_NO_SUCH_TABLE') {
    throw new Error('Table not found. Run database setup.');
  } else {
    throw new Error(`Database error: ${error.message}`);
  }
}
```

---

## Performance Optimizations

### Reduce API Calls
1. **Batch Reads** - Fetch all ROs in one call (not one-by-one)
2. **Cache Aggressively** - 5-minute stale time for ROs
3. **Debounce Searches** - Wait 300ms before searching

### Optimize Queries
1. **MySQL Indexes** - Index on PartNumber
2. **Limit Results** - Max 50 results per search
3. **Select Specific Columns** - Avoid `SELECT *`

### Connection Pooling
- Reuse database connections
- Max 10 concurrent connections

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
