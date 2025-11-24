# GenThrust RO Tracker - Backend Workflow Documentation

**Version:** 2.0
**Last Updated:** 2025-11-24
**Purpose:** Comprehensive reference for the GenThrust RO Tracker backend API
**Deployment:** Netlify Functions (serverless) + Aiven Cloud MySQL

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [Database Architecture](#database-architecture)
4. [API Reference](#api-reference)
5. [Data Flow Workflows](#data-flow-workflows)
6. [Key Features](#key-features)
7. [Error Handling](#error-handling)
8. [Database Schemas](#database-schemas)
9. [Integration Points](#integration-points)
10. [Deployment Guide](#deployment-guide)

---

## Overview

### Architecture

The GenThrust RO Tracker backend is a **Node.js REST API** built with Express.js that manages repair orders, inventory, and AI-powered features.

**Tech Stack:**
- **Runtime:** Node.js (ES6 modules)
- **Framework:** Express.js 4.21.2
- **Database:** MySQL 2 (mysql2 promise adapter)
- **AI Integration:** Anthropic Claude API (@anthropic-ai/sdk)
- **Middleware:** CORS, body-parser, custom error handling
- **Dev Tools:** nodemon for hot reload

**Entry Point:** `backend/server.js`

**Port:** 3001 (configurable via `PORT` environment variable)

### Server Initialization Flow

1. Load environment variables from `.env`
2. Initialize database connection pools (main + inventory)
3. Configure Express middleware (CORS, JSON parsing, logging)
4. Mount API routes
5. Start health check endpoint
6. Global error handler registration
7. Listen on configured port

```javascript
// Middleware Stack (in order)
1. CORS (allow frontend origin)
2. JSON body parser (10MB limit for AI requests)
3. Request logger (method + path + timestamp)
4. Route handlers
5. Global error handler
```

---

## Environment Setup

### Required Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Anthropic AI
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Main Database (Repair Orders & AI Logs)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_database_password
DB_NAME_PROD=ro_tracker_prod
DB_NAME_DEV=ro_tracker_dev

# Inventory Database
DB_NAME_INVENTORY=genthrust_inventory

# Optional: Aiven Cloud SSL
DB_SSL_CA=./ca.pem
```

### Environment-Specific Configuration

**Development:**
- Uses `DB_NAME_DEV` database
- Console logging enabled
- CORS allows local frontend

**Production:**
- Uses `DB_NAME_PROD` database
- Connects to Aiven Cloud with SSL
- CORS configured for production frontend URL
- Rate limiting enforced

---

## Database Architecture

### Multi-Database Strategy

The backend uses **two separate MySQL databases** for logical separation:

#### 1. Main Database (`ro_tracker_prod` / `ro_tracker_dev`)

**Purpose:** Repair order management and AI conversation logging

**Connection Pool:**
- Pool size: 10 connections
- Keep-alive: enabled
- SSL: optional (Aiven Cloud)

**Tables:**
- `active` - Active repair orders
- `paid` - Completed & paid orders
- `net` - NET payment terms orders
- `returns` - Returned/BER/RAI/Scrapped orders
- `ai_conversation_logs` - AI chat history

#### 2. Inventory Database (`genthrust_inventory`)

**Purpose:** Legacy inventory tracking and search

**Connection Pool:**
- Pool size: 5 connections
- Dedicated for inventory operations
- Prevents contention with RO operations

**Tables:**
- `inventoryindex` - Master index (cross-table search)
- `stock_room` - Stock room inventory
- `bins_inventory` - Bin inventory
- `md82_parts`, `727_parts`, `terra`, etc. - Regional/aircraft-specific parts
- `transactions` - Inventory transaction audit log

### Connection Management

**Database Pools (`config/database.js`):**

```javascript
// Main pool - Repair Orders & AI Logs
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: NODE_ENV === 'production' ? DB_NAME_PROD : DB_NAME_DEV,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Inventory pool - Inventory operations only
const inventoryPool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME_INVENTORY,
  connectionLimit: 5,
  enableKeepAlive: true
});
```

**SSL Support (Aiven Cloud):**
- Reads `ca.pem` certificate if `DB_SSL_CA` is specified
- Enables secure connections to cloud database

---

## API Reference

### Health Check

**GET `/health`**

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-23T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

---

### Repair Orders API (`/api/ros`)

Complete CRUD operations for repair order management across multiple archive tables.

#### Architecture Overview

**Archive Status Mapping:**
- `ACTIVE` → `active` table
- `PAID` → `paid` table
- `NET` → `net` table
- `RETURNED` → `returns` table

Each archive status has its own dedicated table. Moving a repair order between statuses involves a transactional move between tables.

#### Endpoints

##### **GET `/api/ros`**

Get all repair orders from specified archive table.

**Query Parameters:**
- `archiveStatus` (optional): `ACTIVE` | `PAID` | `NET` | `RETURNED`
  - Default: `ACTIVE`

**Response:**
```json
[
  {
    "id": "123",
    "roNumber": "RO38462",
    "dateMade": "2024-11-15T00:00:00.000Z",
    "shopName": "ABC Repairs Inc.",
    "partNumber": "A123-456",
    "serialNumber": "SN789",
    "partDescription": "Aircraft hydraulic pump",
    "requiredWork": "Overhaul and test",
    "dateDroppedOff": "2024-11-15T00:00:00.000Z",
    "estimatedCost": "2500.00",
    "finalCost": null,
    "terms": "NET 30",
    "shopReferenceNumber": "REF-2024-11-001",
    "estimatedDeliveryDate": "2024-12-15T00:00:00.000Z",
    "currentStatus": "BEING REPAIRED",
    "currentStatusDate": "2024-11-20T00:00:00.000Z",
    "genThrustStatus": "On Track",
    "shopStatus": "In Progress",
    "trackingNumber": null,
    "notes": "Priority repair",
    "lastDateUpdated": "2024-11-20T00:00:00.000Z",
    "nextDateToUpdate": "2024-12-01T00:00:00.000Z",
    "archiveStatus": "ACTIVE",
    "isOverdue": false,
    "daysOverdue": 0
  }
]
```

---

##### **GET `/api/ros/:id`**

Get a single repair order by ID (searches all archive tables).

**URL Parameters:**
- `id` (required): Repair order ID

**Response:**
```json
{
  "id": "123",
  "roNumber": "RO38462",
  // ... (same structure as GET /api/ros)
}
```

**Errors:**
- `404` - Repair order not found

---

##### **POST `/api/ros`**

Create a new repair order.

**Request Body:**
```json
{
  "roNumber": "RO38463",
  "shopName": "XYZ Repair Services",
  "partDescription": "Landing gear actuator",
  "currentStatus": "WAITING QUOTE",
  "archiveStatus": "ACTIVE",
  "partNumber": "LG-789",
  "dateMade": "2024-11-23",
  "requiredWork": "Inspection and repair",
  "estimatedCost": "1500.00"
}
```

**Required Fields:**
- `roNumber`
- `shopName`
- `partDescription`
- `currentStatus`

**Response:**
```json
{
  "id": "124",
  "roNumber": "RO38463",
  "shopName": "XYZ Repair Services",
  // ... (full RO object)
}
```

**Errors:**
- `400` - Missing required fields
- `409` - Duplicate RO number (exists in any archive table)

---

##### **PATCH `/api/ros/:id`**

Update an existing repair order. If `archiveStatus` changes, performs transactional move between tables.

**URL Parameters:**
- `id` (required): Repair order ID

**Request Body (partial updates):**
```json
{
  "currentStatus": "DELIVERED",
  "finalCost": "2750.00",
  "trackingNumber": "1Z999AA10123456784",
  "archiveStatus": "PAID"  // Optional: triggers table move
}
```

**Archive Move Logic:**
When `archiveStatus` is included and different from current:
1. Begin transaction
2. Insert merged data (current + updates) into new table
3. Delete from old table
4. Commit transaction
5. Return updated RO

**Response:**
```json
{
  "id": "123",
  "archiveStatus": "PAID",
  "currentStatus": "DELIVERED",
  "finalCost": "2750.00",
  // ... (updated RO object)
}
```

**Errors:**
- `404` - RO not found
- `500` - Transaction failed (rollback automatic)

---

##### **DELETE `/api/ros/:id`**

Permanently delete a repair order (searches all tables).

**URL Parameters:**
- `id` (required): Repair order ID

**Response:**
```json
{
  "success": true,
  "message": "Repair order deleted",
  "deletedFrom": "active"
}
```

**Errors:**
- `404` - RO not found

---

##### **GET `/api/ros/stats/dashboard`**

Get aggregated statistics for dashboard display.

**Response:**
```json
{
  "totalActive": 45,
  "overdue": 12,
  "waitingQuote": 8,
  "approved": 15,
  "beingRepaired": 18,
  "shipping": 4,
  "dueToday": 3,
  "overdue30Plus": 5,
  "onTrack": 33,
  "totalValue": "125000.00",
  "totalEstimatedValue": "125000.00",
  "totalFinalValue": "0.00",
  "approvedPaid": 102,
  "approvedNet": 23,
  "rai": 5,
  "ber": 3,
  "cancel": 2,
  "scrapped": 1
}
```

**Calculation Logic:**
- `overdue`: `nextDateToUpdate < TODAY`
- `overdue30Plus`: `nextDateToUpdate < (TODAY - 30 days)`
- `onTrack`: `nextDateToUpdate >= TODAY`
- Values sum `estimatedCost` (active) and `finalCost` (archived)

---

### Inventory API (`/api/inventory`)

Inventory search, management, and low stock tracking.

#### Endpoints

##### **GET `/api/inventory/search`**

Search inventory by part number with 3-tier fallback logic.

**Query Parameters:**
- `partNumber` (required): Part number to search

**Search Algorithm:**
1. **Exact match** on `inventoryindex.PartNumber`
2. If not found → **LIKE search** on `inventoryindex.PartNumber`
3. If still not found → **Direct search** on `stock_room` + `bins_inventory`

**Response:**
```json
{
  "results": [
    {
      "indexId": "12345",
      "partNumber": "A123-456",
      "tableName": "stock_room",
      "rowId": 789,
      "qty": 15,
      "condition": "SV",
      "location": "Shelf A-12",
      "description": "Hydraulic pump assembly"
    }
  ],
  "totalResults": 1,
  "searchMethod": "exact"  // "exact" | "like" | "direct"
}
```

**Limits:**
- Exact match: unlimited
- LIKE search: 50 results
- Direct search: 25 from stock_room + 25 from bins_inventory

**Errors:**
- `400` - Missing partNumber parameter
- `404` - No results found

---

##### **GET `/api/inventory/table/:tableName`**

Get all items from a specific inventory table.

**URL Parameters:**
- `tableName` (required): Valid table name

**Valid Tables:**
- `bins_inventory`
- `stock_room`
- `md82_parts`
- `727_parts`
- `terra`
- `asia_ar_parts`
- `b_e_r__r_a_i`
- `bolivia_part`
- `delta_apa`
- `asia_ar_sanford_parts`
- `apa_sanford_ar_757`

**Response:**
```json
{
  "tableName": "stock_room",
  "items": [ /* array of items */ ],
  "count": 1250
}
```

**Errors:**
- `400` - Invalid table name
- `404` - Table not found

---

##### **GET `/api/inventory/stock-room`**

Get stock room inventory with optional filters.

**Query Parameters:**
- `location` (optional): Filter by location
- `condition` (optional): Filter by condition
- `search` (optional): Search in part number or description

**Response:**
```json
{
  "items": [
    {
      "id": "123",
      "partNumber": "A123",
      "qty": 10,
      "serial": "SN-001",
      "condition": "SV",
      "location": "A-12",
      "description": "Pump assembly"
    }
  ],
  "count": 1,
  "filters": {
    "location": "A-12",
    "condition": null,
    "search": null
  }
}
```

---

##### **GET `/api/inventory/bins`**

Get bins inventory with optional filters.

**Query Parameters:**
- `location` (optional): Filter by location
- `bin` (optional): Filter by bin number
- `search` (optional): Search in part number or description

**Response:**
```json
{
  "items": [ /* similar to stock-room */ ],
  "count": 45,
  "filters": {
    "location": null,
    "bin": "B-5",
    "search": null
  }
}
```

---

##### **GET `/api/inventory/tables`**

List all inventory tables with item counts.

**Response:**
```json
{
  "tables": [
    {
      "name": "stock_room",
      "displayName": "Stock Room",
      "count": 1250
    },
    {
      "name": "bins_inventory",
      "displayName": "Bins Inventory",
      "count": 850
    }
    // ... more tables
  ],
  "totalTables": 11,
  "totalItems": 5432
}
```

---

##### **GET `/api/inventory/stats`**

Get inventory statistics.

**Response:**
```json
{
  "totalParts": 5432,
  "totalQuantity": 15678,
  "lowStockItems": 42,
  "outOfStockItems": 8,
  "tableBreakdown": [
    {
      "table": "stock_room",
      "parts": 1250,
      "quantity": 4500
    }
  ]
}
```

---

##### **GET `/api/inventory/low-stock`**

Get items below specified threshold with reorder recommendations.

**Query Parameters:**
- `threshold` (optional): Quantity threshold (default: 5)

**Response:**
```json
{
  "threshold": 5,
  "totalLowStockItems": 42,
  "criticalItems": 3,
  "highUrgencyItems": 8,
  "mediumUrgencyItems": 15,
  "lowUrgencyItems": 16,
  "items": [
    {
      "indexId": "12345",
      "partNumber": "A123",
      "tableName": "stock_room",
      "currentQty": 0,
      "usage90Days": 15,
      "monthlyUsageRate": 5.0,
      "recommendedReorder": 15,
      "urgency": "critical",
      "daysUntilStockout": null,
      "location": "A-12",
      "condition": "SV"
    }
  ]
}
```

**Urgency Calculation:**
- `critical`: qty = 0
- `high`: qty < 2 OR daysUntilStockout < 30
- `medium`: qty < threshold AND daysUntilStockout < 60
- `low`: qty < threshold

**Recommended Reorder:** `(monthlyUsageRate * 3) + 5`

---

##### **POST `/api/inventory/decrement`**

Decrement inventory quantity and log transaction.

**Request Body:**
```json
{
  "indexId": "12345",
  "partNumber": "A123-456",
  "roNumber": "RO38462",
  "notes": "Used for RO38462 repair"
}
```

**Required Fields:**
- `indexId`
- `partNumber`

**Transaction Flow:**
1. Get connection from pool
2. Begin transaction
3. Validate item exists and qty >= 1
4. Update `inventoryindex` SET qty = qty - 1
5. Insert into `transactions` table
6. Commit transaction
7. Release connection

**Response:**
```json
{
  "success": true,
  "indexId": "12345",
  "partNumber": "A123-456",
  "previousQty": 5,
  "newQty": 4,
  "isLowStock": false,
  "transactionId": 9876
}
```

**Low Stock Flag:** `newQty < 2`

**Errors:**
- `400` - Missing required fields
- `404` - Item not found
- `409` - Insufficient quantity (qty < 1)
- `500` - Transaction failed

---

### AI Proxy API (`/api/ai`)

Proxies requests to Anthropic Claude API with rate limiting.

#### Endpoints

##### **POST `/api/ai/chat`**

Main AI chat endpoint with support for streaming and non-streaming responses.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Show me all overdue repair orders"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 4096,
  "temperature": 0.2,
  "tools": [
    {
      "name": "get_repair_orders",
      "description": "Get repair orders from database",
      "input_schema": { /* ... */ }
    }
  ],
  "systemPrompt": "You are a helpful repair order assistant.",
  "stream": false,
  "userId": "user@example.com"
}
```

**Valid Models:**
- `claude-sonnet-4-20250514` (default, recommended)
- `claude-3-5-sonnet-20241022`
- `claude-3-5-sonnet-20240620`
- `claude-3-opus-20240229`
- `claude-3-haiku-20240307`

**Rate Limiting:**
- **Limit:** 3 requests per minute per user
- **Window:** Sliding 60-second window
- **Storage:** In-memory (not suitable for production clusters)

**Non-Streaming Response:**
```json
{
  "response": {
    "id": "msg_01ABC123",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "Here are the overdue repair orders..."
      }
    ],
    "model": "claude-sonnet-4-20250514",
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 245,
      "output_tokens": 156
    }
  },
  "metadata": {
    "durationMs": 1250,
    "model": "claude-sonnet-4-20250514",
    "cached": false
  }
}
```

**Streaming Response:**
- Content-Type: `text/event-stream`
- Format: Server-Sent Events (SSE)
- Sends raw Anthropic stream events
- Ends with `[DONE]` marker

```
data: {"type":"message_start","message":{"id":"msg_01ABC"}}

data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Here"}}

data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" are"}}

data: [DONE]
```

**Errors:**
- `400` - Invalid request format
- `429` - Rate limit exceeded
  ```json
  {
    "error": "Rate limit exceeded",
    "retryAfter": 45
  }
  ```
- `503` - Anthropic API key not configured

---

##### **GET `/api/ai/health`**

Check AI proxy service health.

**Response:**
```json
{
  "status": "ok",
  "apiKeyConfigured": true,
  "models": [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022"
  ]
}
```

---

##### **POST `/api/ai/clear-rate-limit`**

Clear rate limit for a specific user (admin operation).

**Request Body:**
```json
{
  "userId": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rate limit cleared for user@example.com"
}
```

---

### AI Logs API (`/api/ai-logs`)

Conversation logging and retrieval for AI interactions.

#### Endpoints

##### **POST `/api/ai-logs`**

Save an AI conversation log entry.

**Request Body:**
```json
{
  "conversationId": "conv-abc-123",
  "user": "user@example.com",
  "userMessage": "Show me overdue ROs",
  "aiResponse": "Here are the overdue repair orders: RO38462, RO38465...",
  "success": true,
  "error": null,
  "model": "claude-sonnet-4",
  "durationMs": 1250,
  "contextRoCount": 100
}
```

**Required Fields:**
- `conversationId`
- `user`
- `userMessage`
- `aiResponse`
- `success`

**Response:**
```json
{
  "success": true,
  "id": 12345
}
```

---

##### **GET `/api/ai-logs`**

Get conversation logs with pagination and filtering.

**Query Parameters:**
- `limit` (optional): Results per page (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `user` (optional): Filter by user email
- `conversationId` (optional): Filter by conversation
- `startDate` (optional): Filter by date range (ISO 8601)
- `endDate` (optional): Filter by date range (ISO 8601)

**Response:**
```json
{
  "logs": [
    {
      "id": 12345,
      "conversationId": "conv-abc-123",
      "timestamp": "2024-11-23T12:00:00.000Z",
      "user": "user@example.com",
      "userMessage": "Show me overdue ROs",
      "aiResponse": "Here are the overdue repair orders...",
      "success": true,
      "error": null,
      "model": "claude-sonnet-4",
      "durationMs": 1250,
      "contextRoCount": 100
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

##### **GET `/api/ai-logs/conversation/:conversationId`**

Get all logs for a specific conversation.

**URL Parameters:**
- `conversationId` (required): Conversation UUID

**Response:**
```json
{
  "conversationId": "conv-abc-123",
  "logs": [ /* array of log entries */ ],
  "messageCount": 5,
  "firstMessage": "2024-11-23T11:00:00.000Z",
  "lastMessage": "2024-11-23T12:00:00.000Z"
}
```

**Errors:**
- `404` - Conversation not found

---

##### **DELETE `/api/ai-logs/:id`**

Delete a specific log entry.

**URL Parameters:**
- `id` (required): Log entry ID

**Response:**
```json
{
  "success": true,
  "message": "Log deleted"
}
```

**Errors:**
- `404` - Log not found

---

##### **DELETE `/api/ai-logs/user/:user`**

Delete all logs for a specific user.

**URL Parameters:**
- `user` (required): User email

**Response:**
```json
{
  "success": true,
  "deletedCount": 42
}
```

---

##### **GET `/api/ai-logs/stats`**

Get logging statistics.

**Response:**
```json
{
  "totalLogs": 1250,
  "totalConversations": 145,
  "totalUsers": 12,
  "successRate": 0.98,
  "averageDuration": 1150,
  "topModels": [
    {
      "model": "claude-sonnet-4",
      "count": 1100
    }
  ],
  "topUsers": [
    {
      "user": "user@example.com",
      "count": 450
    }
  ]
}
```

---

## Data Flow Workflows

### Workflow 1: Create Repair Order

```
User Request → POST /api/ros
    ↓
1. Validate required fields (roNumber, shopName, partDescription, currentStatus)
    ↓
2. Determine target table from archiveStatus (default: ACTIVE)
    ↓
3. Check for duplicate roNumber in ALL archive tables
    ↓
4. If duplicate found → Return 409 Conflict
    ↓
5. If unique → INSERT INTO target table
    ↓
6. Fetch newly created record with generated ID
    ↓
7. Format dates (MySQL → ISO 8601)
    ↓
8. Calculate isOverdue and daysOverdue
    ↓
9. Return formatted RepairOrder object
```

**Example:**
```javascript
// Request
POST /api/ros
{
  "roNumber": "RO38464",
  "shopName": "ABC Repairs",
  "partDescription": "Hydraulic pump",
  "currentStatus": "WAITING QUOTE",
  "dateMade": "2024-11-23"
}

// Database INSERT
INSERT INTO active (RO, SHOP_NAME, PART_DESCRIPTION, CURENT_STATUS, DATE_MADE)
VALUES ('RO38464', 'ABC Repairs', 'Hydraulic pump', 'WAITING QUOTE', '2024-11-23');

// Response
{
  "id": "125",
  "roNumber": "RO38464",
  "shopName": "ABC Repairs",
  "partDescription": "Hydraulic pump",
  "currentStatus": "WAITING QUOTE",
  "archiveStatus": "ACTIVE",
  // ...
}
```

---

### Workflow 2: Archive Repair Order (Move Between Tables)

```
User Request → PATCH /api/ros/:id { archiveStatus: "PAID" }
    ↓
1. Find current RO in all archive tables
    ↓
2. If not found → Return 404
    ↓
3. If found → Extract current archiveStatus (e.g., "ACTIVE")
    ↓
4. Check if archiveStatus is changing ("ACTIVE" → "PAID")
    ↓
5. BEGIN TRANSACTION
    ↓
6. Merge current RO data + updates
    ↓
7. INSERT INTO paid table (merged data)
    ↓
8. DELETE FROM active table WHERE id = :id
    ↓
9. COMMIT TRANSACTION
    ↓
10. Fetch updated RO from new table
    ↓
11. Return formatted RO with new archiveStatus
    ↓
On Error → ROLLBACK TRANSACTION
```

**Transaction Example:**
```sql
BEGIN;

-- Insert into new table
INSERT INTO paid (RO, SHOP_NAME, ..., FINAL_COST, CURENT_STATUS)
SELECT RO, SHOP_NAME, ..., 2750.00, 'DELIVERED'
FROM active
WHERE id = 123;

-- Delete from old table
DELETE FROM active WHERE id = 123;

COMMIT;
```

**Key Points:**
- Atomic operation (all or nothing)
- Preserves all RO data during move
- Updates can be applied simultaneously
- Automatic rollback on any error

---

### Workflow 3: Inventory Search (3-Tier Fallback)

```
User Request → GET /api/inventory/search?partNumber=A123-456
    ↓
1. Normalize input (uppercase, trim)
    ↓
2. TIER 1: Exact Match Query on inventoryindex
   SELECT * FROM inventoryindex WHERE PartNumber = 'A123-456'
    ↓
3. If results found → Return with searchMethod: "exact"
    ↓
4. TIER 2: LIKE Search on inventoryindex
   SELECT * FROM inventoryindex WHERE PartNumber LIKE '%A123-456%' LIMIT 50
    ↓
5. If results found → Return with searchMethod: "like"
    ↓
6. TIER 3: Direct Table Search
   a) SELECT * FROM stock_room WHERE PN LIKE '%A123-456%' LIMIT 25
   b) SELECT * FROM bins_inventory WHERE PN LIKE '%A123-456%' LIMIT 25
    ↓
7. Combine results from both tables
    ↓
8. Return with searchMethod: "direct"
    ↓
9. If still no results → Return 404
```

**Performance Characteristics:**
- Tier 1 (Exact): O(1) with indexed PartNumber
- Tier 2 (LIKE): O(n) scan with 50 result limit
- Tier 3 (Direct): O(n) on two tables with 25 limit each

**Why 3-Tier?**
- Optimizes common case (exact matches) for speed
- Provides fuzzy matching when needed
- Falls back to direct search for legacy data not in index

---

### Workflow 4: Inventory Decrement with Transaction Logging

```
User Request → POST /api/inventory/decrement
{
  "indexId": "12345",
  "partNumber": "A123-456",
  "roNumber": "RO38462",
  "notes": "Used for repair"
}
    ↓
1. Get connection from inventoryPool
    ↓
2. BEGIN TRANSACTION
    ↓
3. Query current item:
   SELECT * FROM inventoryindex WHERE IndexId = '12345'
    ↓
4. Validate:
   - Item exists
   - Current Qty >= 1
    ↓
5. If validation fails → ROLLBACK → Return 404/409
    ↓
6. UPDATE inventoryindex
   SET Qty = Qty - 1
   WHERE IndexId = '12345'
    ↓
7. INSERT INTO transactions
   (Timestamp, Action, PartNumber, DeltaQty, NewQty, RONumber, Note)
   VALUES (NOW(), 'DECREMENT', 'A123-456', -1, 4, 'RO38462', 'Used for repair')
    ↓
8. COMMIT TRANSACTION
    ↓
9. Calculate isLowStock (newQty < 2)
    ↓
10. Release connection
    ↓
11. Return success response with updated quantities
    ↓
On Error → ROLLBACK → Release connection → Return 500
```

**Transaction Guarantees:**
- Inventory update and transaction log are atomic
- No partial updates possible
- Connection released in finally block (even on error)

**Response:**
```json
{
  "success": true,
  "indexId": "12345",
  "partNumber": "A123-456",
  "previousQty": 5,
  "newQty": 4,
  "isLowStock": false,  // true if newQty < 2
  "transactionId": 9876
}
```

---

### Workflow 5: AI Chat with Rate Limiting

```
User Request → POST /api/ai/chat
{
  "messages": [...],
  "userId": "user@example.com",
  "stream": false
}
    ↓
1. Check Rate Limiter
   - Get user's request history from in-memory store
   - Filter requests within last 60 seconds
   - Count = requests in window
    ↓
2. If count >= 3 → Return 429 Rate Limit Exceeded
   {
     "error": "Rate limit exceeded",
     "retryAfter": 45  // seconds until window clears
   }
    ↓
3. If count < 3 → Add current request to history
    ↓
4. Validate request structure
   - messages array present
   - model is valid
    ↓
5. Prepare Anthropic API call
   - Set model, maxTokens, temperature
   - Include tools if provided
   - Add system prompt if provided
    ↓
6a. If stream = true:
    - Set headers: Content-Type: text/event-stream
    - Create Anthropic stream
    - Pipe events to response
    - Send [DONE] on completion
    ↓
6b. If stream = false:
    - Call Anthropic messages.create()
    - Wait for complete response
    - Calculate duration
    - Return response + metadata
    ↓
7. Log request/response (optional)
    ↓
On Error:
  - Catch Anthropic API errors
  - Return formatted error response
  - Log error details
```

**Rate Limiter Implementation:**
```javascript
// In-memory sliding window
const rateLimitStore = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const userRequests = rateLimitStore.get(userId) || [];

  // Filter requests within last 60 seconds
  const recentRequests = userRequests.filter(
    timestamp => now - timestamp < 60000
  );

  if (recentRequests.length >= 3) {
    const oldestRequest = Math.min(...recentRequests);
    const retryAfter = Math.ceil((60000 - (now - oldestRequest)) / 1000);
    return { allowed: false, retryAfter };
  }

  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(userId, recentRequests);

  return { allowed: true };
}
```

**Note:** In-memory rate limiting is not suitable for multi-instance deployments. Use Redis for production.

---

## Key Features

### 1. Transaction Support

**Where Used:**
- Repair order archiving (move between tables)
- Inventory decrement (update + log)

**Benefits:**
- Atomicity: All operations succeed or all fail
- Consistency: Database never in invalid state
- Rollback on error: Automatic cleanup

**Implementation Pattern:**
```javascript
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();

  // Operation 1
  await connection.query('INSERT INTO ...');

  // Operation 2
  await connection.query('DELETE FROM ...');

  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

---

### 2. Rate Limiting (AI Proxy)

**Configuration:**
- **Window:** 60 seconds (sliding)
- **Limit:** 3 requests per user
- **Storage:** In-memory Map (not production-ready)

**For Production:**
- Use Redis with sliding window
- Distributed rate limiting
- Per-route limits
- Burst allowance

---

### 3. Low Stock Analysis

**Calculation Logic:**

```javascript
// 1. Get usage from last 90 days
const usage90Days = await getUsageFromTransactions(partNumber, 90);

// 2. Calculate monthly rate
const monthlyUsageRate = usage90Days / 3;

// 3. Recommended reorder (3 months + 5 buffer)
const recommendedReorder = Math.max((monthlyUsageRate * 3) + 5, 10);

// 4. Days until stockout
const daysUntilStockout = monthlyUsageRate > 0
  ? Math.floor((currentQty / monthlyUsageRate) * 30)
  : null;

// 5. Urgency level
if (currentQty === 0) urgency = 'critical';
else if (currentQty < 2 || daysUntilStockout < 30) urgency = 'high';
else if (currentQty < threshold && daysUntilStockout < 60) urgency = 'medium';
else urgency = 'low';
```

**Features:**
- Usage-based reordering
- Stockout prediction
- Urgency classification
- Minimum reorder threshold

---

### 4. Dashboard Statistics

**Aggregations:**

```javascript
// Active ROs by status
const waitingQuote = activeROs.filter(ro => ro.currentStatus === 'WAITING QUOTE').length;
const approved = activeROs.filter(ro => ro.currentStatus === 'APPROVED').length;
const beingRepaired = activeROs.filter(ro => ro.currentStatus === 'BEING REPAIRED').length;
const shipping = activeROs.filter(ro => ro.currentStatus.includes('SHIPPING')).length;

// Overdue calculations
const today = new Date();
const overdue = activeROs.filter(ro =>
  ro.nextDateToUpdate && new Date(ro.nextDateToUpdate) < today
).length;

const overdue30Plus = activeROs.filter(ro => {
  const daysOverdue = Math.floor((today - new Date(ro.nextDateToUpdate)) / (1000 * 60 * 60 * 24));
  return daysOverdue > 30;
}).length;

// Value calculations
const totalEstimatedValue = activeROs.reduce((sum, ro) =>
  sum + (parseFloat(ro.estimatedCost) || 0), 0
);

const totalFinalValue = paidROs.reduce((sum, ro) =>
  sum + (parseFloat(ro.finalCost) || 0), 0
);
```

---

### 5. Column Mapping (Excel ↔ JavaScript)

**Automatic Transformation:**

Excel columns use underscores and uppercase:
- `RO`, `DATE_MADE`, `SHOP_NAME`, `CURENT_STATUS`

JavaScript uses camelCase:
- `roNumber`, `dateMade`, `shopName`, `currentStatus`

**Helper Functions:**
```javascript
// MySQL → API Response
function formatROForResponse(dbRow) {
  return {
    id: dbRow.id,
    roNumber: dbRow.RO,
    dateMade: formatDateForResponse(dbRow.DATE_MADE),
    shopName: dbRow.SHOP_NAME,
    currentStatus: dbRow.CURENT_STATUS,
    // ... map all 20+ fields
    archiveStatus: determineArchiveStatus(tableName),
    isOverdue: dbRow.NEXT_DATE_TO_UPDATE < new Date(),
    daysOverdue: calculateDaysOverdue(dbRow.NEXT_DATE_TO_UPDATE)
  };
}

// API Request → MySQL
function formatROForDatabase(roObject) {
  return {
    RO: roObject.roNumber,
    DATE_MADE: formatDateForMySQL(roObject.dateMade),
    SHOP_NAME: roObject.shopName,
    CURENT_STATUS: roObject.currentStatus,
    // ... map all fields
  };
}
```

---

## Error Handling

### Error Response Format

**Standard Error Structure:**
```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": { /* optional context */ }
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (create) |
| 400 | Bad Request | Validation errors, missing fields |
| 404 | Not Found | RO/item/log not found |
| 409 | Conflict | Duplicate RO number, insufficient qty |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Database errors, unexpected errors |
| 503 | Service Unavailable | Missing API keys, database down |

### Error Handling Patterns

#### Route-Level Try-Catch

```javascript
app.get('/api/ros/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Business logic
    const ro = await findROById(id);

    if (!ro) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Repair order not found'
      });
    }

    res.json(ro);
  } catch (error) {
    console.error('[RO API] Error fetching RO:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});
```

#### Global Error Handler

```javascript
// Catches all unhandled errors
app.use((err, req, res, next) => {
  console.error('[Server Error]:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred'
  });
});
```

#### Transaction Error Handling

```javascript
async function moveROBetweenTables(id, newTable, updates) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Operation 1
    await connection.query('INSERT INTO ...');

    // Operation 2
    await connection.query('DELETE FROM ...');

    await connection.commit();
    return { success: true };

  } catch (error) {
    await connection.rollback();
    console.error('[Transaction Error]:', error);
    throw new Error(`Failed to move RO: ${error.message}`);

  } finally {
    connection.release();
  }
}
```

### Logging Strategy

**Request Logging:**
```javascript
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

**Error Logging:**
```javascript
console.error('[Module Name] Error description:', error, {
  context: 'Additional context',
  userId: 'user@example.com',
  timestamp: new Date().toISOString()
});
```

**Prefixes by Module:**
- `[RO API]` - Repair order routes
- `[Inventory API]` - Inventory routes
- `[AI Proxy]` - AI proxy routes
- `[AI Logs]` - Logging routes
- `[Database]` - Database operations
- `[Server Error]` - Global error handler

---

## Database Schemas

### Main Database (ro_tracker_prod / ro_tracker_dev)

#### Table: `active` (also `paid`, `net`, `returns`)

```sql
CREATE TABLE active (
  id INT AUTO_INCREMENT PRIMARY KEY,
  RO VARCHAR(50) UNIQUE NOT NULL,
  DATE_MADE DATE,
  SHOP_NAME VARCHAR(255),
  PART VARCHAR(100),
  SERIAL VARCHAR(100),
  PART_DESCRIPTION TEXT,
  REQ_WORK TEXT,
  DATE_DROPPED_OFF DATE,
  ESTIMATED_COST DECIMAL(10,2),
  FINAL_COST DECIMAL(10,2),
  TERMS VARCHAR(50),
  SHOP_REF VARCHAR(100),
  ESTIMATED_DELIVERY_DATE DATE,
  CURENT_STATUS VARCHAR(100),
  CURENT_STATUS_DATE DATE,
  GENTHRUST_STATUS VARCHAR(100),
  SHOP_STATUS VARCHAR(100),
  TRACKING_NUMBER_PICKING_UP VARCHAR(100),
  NOTES TEXT,
  LAST_DATE_UPDATED DATE,
  NEXT_DATE_TO_UPDATE DATE,
  INDEX idx_ro (RO),
  INDEX idx_status (CURENT_STATUS),
  INDEX idx_next_update (NEXT_DATE_TO_UPDATE)
);
```

**Archive Tables:**
- `active` - Active repair orders
- `paid` - Completed and paid
- `net` - NET payment terms
- `returns` - Returned, BER, RAI, Scrapped

---

#### Table: `ai_conversation_logs`

```sql
CREATE TABLE ai_conversation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(100) NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user VARCHAR(255) NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  model VARCHAR(100),
  duration_ms INT,
  context_ro_count INT,
  INDEX idx_conversation (conversation_id),
  INDEX idx_user (user),
  INDEX idx_timestamp (timestamp)
);
```

**Indexes:**
- `conversation_id` - Fast conversation retrieval
- `user` - Filter by user
- `timestamp` - Date range queries

---

### Inventory Database (genthrust_inventory)

#### Table: `inventoryindex`

```sql
CREATE TABLE inventoryindex (
  IndexId INT AUTO_INCREMENT PRIMARY KEY,
  PartNumber VARCHAR(100) NOT NULL,
  TableName VARCHAR(100) NOT NULL,
  RowId INT NOT NULL,
  Qty INT DEFAULT 0,
  Condition VARCHAR(50),
  Location VARCHAR(100),
  UNIQUE KEY unique_location (TableName, RowId),
  INDEX idx_part_number (PartNumber)
);
```

**Purpose:** Master index for cross-table inventory search

**Key Columns:**
- `PartNumber` - Indexed for fast lookup
- `TableName` - Source table name
- `RowId` - ID in source table
- `Qty` - Current quantity

---

#### Table: `stock_room`

```sql
CREATE TABLE stock_room (
  id INT AUTO_INCREMENT PRIMARY KEY,
  PN VARCHAR(100),
  QTY INT,
  SERIAL VARCHAR(100),
  COND VARCHAR(50),
  LOCATION VARCHAR(100),
  DESCRIPTION TEXT,
  INDEX idx_pn (PN)
);
```

---

#### Table: `bins_inventory`

```sql
CREATE TABLE bins_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  PN VARCHAR(100),
  Qty INT,
  SERIAL VARCHAR(100),
  CONDITION VARCHAR(50),
  LOCATION VARCHAR(100),
  DESCRIPTION TEXT,
  INDEX idx_pn (PN)
);
```

---

#### Table: `transactions`

```sql
CREATE TABLE transactions (
  TxnId INT AUTO_INCREMENT PRIMARY KEY,
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  Action VARCHAR(50) NOT NULL,
  PartNumber VARCHAR(100) NOT NULL,
  DeltaQty INT NOT NULL,
  NewQty INT NOT NULL,
  RONumber VARCHAR(50),
  Note TEXT,
  INDEX idx_part_number (PartNumber),
  INDEX idx_timestamp (Timestamp),
  INDEX idx_ro_number (RONumber)
);
```

**Purpose:** Audit log for all inventory changes

**Actions:**
- `DECREMENT` - Quantity decreased
- `INCREMENT` - Quantity increased (future)
- `ADJUSTMENT` - Manual adjustment (future)

---

## Integration Points

### 1. Frontend Communication

**CORS Configuration:**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

**Request Format:**
- Content-Type: `application/json`
- Body size limit: 10MB (for AI requests with context)

**Response Format:**
- Content-Type: `application/json`
- ISO 8601 date strings
- Consistent error structure

---

### 2. Anthropic API Integration

**SDK Configuration:**
```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

**Message Creation:**
```javascript
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  temperature: 0.2,
  system: systemPrompt,
  messages: conversationHistory,
  tools: aiTools  // Optional function calling
});
```

**Streaming:**
```javascript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  messages: conversationHistory
});

stream
  .on('text', (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`))
  .on('end', () => res.write('data: [DONE]\n\n'))
  .on('error', (error) => console.error('Stream error:', error));
```

---

### 3. MySQL Database

**Connection Pooling:**
```javascript
// Main pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: currentDatabase,
  connectionLimit: 10
});

// Inventory pool
const inventoryPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME_INVENTORY,
  connectionLimit: 5
});
```

**Query Execution:**
```javascript
// Simple query
const [rows] = await pool.query('SELECT * FROM active WHERE id = ?', [id]);

// Transaction
const connection = await pool.getConnection();
await connection.beginTransaction();
await connection.query('INSERT INTO ...');
await connection.commit();
connection.release();
```

---

### 4. External Services

**Current Integrations:**
- Anthropic API (Claude AI models)
- MySQL databases (local or Aiven Cloud)

**Future Integration Points:**
- Redis (for distributed rate limiting)
- Email service (for notifications)
- File storage (for attachments)

---

## Deployment Guide

### Development Setup

1. **Install Dependencies:**
```bash
cd backend
npm install
```

2. **Configure Environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Setup Database:**
```bash
# Import schema
mysql -u root -p < schema.sql

# Or use migrations
npm run migrate
```

4. **Start Development Server:**
```bash
npm run dev  # Uses nodemon for hot reload
```

Server starts at: `http://localhost:3001`

---

### Production Deployment

#### 1. Environment Configuration

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com

# Aiven Cloud MySQL
DB_HOST=mysql-genthrust-prod.aivencloud.com
DB_PORT=3306
DB_USER=avnadmin
DB_PASSWORD=<secure_password>
DB_NAME_PROD=ro_tracker_prod
DB_NAME_INVENTORY=genthrust_inventory
DB_SSL_CA=./ca.pem

# Anthropic API
ANTHROPIC_API_KEY=<production_key>
```

#### 2. SSL Certificate Setup

For Aiven Cloud:
```bash
# Download ca.pem from Aiven dashboard
curl -o ca.pem https://your-aiven-instance.com/ca.pem
```

#### 3. Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start server.js --name "genthrust-backend"

# Configure auto-restart
pm2 startup
pm2 save
```

#### 4. Reverse Proxy (nginx)

```nginx
server {
  listen 80;
  server_name api.genthrust.com;

  location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

#### 5. Monitoring

**Logs:**
```bash
pm2 logs genthrust-backend
```

**Health Check:**
```bash
curl http://localhost:3001/health
```

**Database Connection Test:**
```bash
curl http://localhost:3001/api/ros?limit=1
```

---

### Netlify Functions Deployment (Current Architecture)

**Current Deployment:** The backend is deployed as **Netlify Functions** (serverless) alongside the frontend.

#### Architecture Overview

```
netlify/
  └── functions/
      └── api.js          # Serverless wrapper for Express app

backend/
  ├── app.js              # Express application (imported by Netlify Function)
  ├── server.js           # Local development server only
  └── routes/             # API routes
```

**How It Works:**
- **Local Development:** `npm start` runs Express on `http://localhost:3001`
- **Production:** Netlify Functions wraps Express and deploys to `/.netlify/functions/api`

#### 1. Netlify Functions Wrapper (`netlify/functions/api.js`)

```javascript
import serverless from 'serverless-http';
import appImport from '../../backend/app.js';

// Defensive unwrapping - handles ES module default export wrapping
let app = appImport;

// Peel back the first layer (ES Module Default)
if (app.default) {
  app = app.default;
}

// Peel back a potential second layer (Bundler Artifact)
if (app.default) {
  app = app.default;
}

// Final validation - Express apps must have .use() method
if (!app || typeof app.use !== 'function') {
  console.error('[Netlify] CRITICAL ERROR: Express app not found in import');
  console.error('[Netlify] Import structure:', Object.keys(appImport || {}));
  throw new Error('Unsupported framework: Express app not found');
}

export const handler = serverless(app);
console.log('[Netlify] Handler initialized successfully');
```

**Key Points:**
- Uses `serverless-http` to wrap Express for serverless deployment
- Handles ES module default export wrapping (single and double wrapping)
- Validates Express app before wrapping
- No need to modify `backend/app.js` - it remains a standard Express app

#### 2. Environment Variables Configuration

**Set in Netlify Dashboard:** Site Settings → Environment Variables

**Backend Environment Variables:**
```env
# Required
ANTHROPIC_API_KEY=your-anthropic-api-key
FRONTEND_URL=https://genthrust-repairs.netlify.app

# Aiven Cloud MySQL
DB_HOST=genthrust-inventory-genthrust2017.b.aivencloud.com
DB_PORT=27562
DB_USER=avnadmin
DB_PASSWORD=your-aiven-password
DB_NAME=genthrust_inventory
DB_SSL_MODE=REQUIRED

# Optional (for local dev only)
PORT=3001
```

**Frontend Environment Variables:**
```env
VITE_BACKEND_URL=https://genthrust-repairs.netlify.app/.netlify/functions/api
VITE_API_BASE_URL=https://genthrust-repairs.netlify.app/.netlify/functions/api
# ... other VITE_* variables
```

#### 3. API Endpoints

All API routes are prefixed with `/.netlify/functions/api`:

| Endpoint | Production URL |
|----------|----------------|
| Health Check | `/.netlify/functions/api/health` |
| Inventory Search | `/.netlify/functions/api/inventory/search` |
| AI Chat | `/.netlify/functions/api/ai/chat` |
| RO Stats | `/.netlify/functions/api/ros/stats/dashboard` |

#### 4. Configuration Files

**`netlify.toml`:**
```toml
[build]
  command = "cd repair-dashboard && npm install --include=dev && npm run build"
  publish = "repair-dashboard/dist"
  base = "/"

[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "10"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Note:** Netlify automatically detects functions in `netlify/functions/` directory - no additional configuration needed.

#### 5. Deployment Process

**Automatic Deployment:**
1. Push to main branch on GitHub
2. Netlify detects changes and triggers build
3. Builds frontend: `cd repair-dashboard && npm run build`
4. Bundles Netlify Functions: Packages `netlify/functions/api.js` and `backend/` dependencies
5. Deploys both frontend and backend together

**Manual Deployment:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

#### 6. Monitoring & Debugging

**View Logs:**
- Go to Netlify Dashboard → Functions → [api] → Logs
- Real-time logs show function invocations and errors

**Health Check:**
```bash
curl https://genthrust-repairs.netlify.app/.netlify/functions/api/health
```

**Common Issues:**

1. **"Unsupported framework" error**
   - Cause: ES module default export wrapping issue
   - Fix: Defensive unwrapping in `netlify/functions/api.js` (already implemented)

2. **Function timeout (10 seconds)**
   - Cause: Long-running operations (e.g., AI requests)
   - Fix: Optimize queries, use streaming responses, or upgrade to Pro plan (26 seconds)

3. **Cold starts (1-2 seconds)**
   - Cause: Function hasn't been invoked recently
   - Fix: Normal behavior for serverless - consider using keep-alive service or upgrade plan

#### 7. Advantages of Netlify Functions

✅ **No server management** - Fully managed, auto-scaling
✅ **Automatic SSL** - HTTPS included
✅ **Global CDN** - Fast edge deployment
✅ **Integrated deployment** - Frontend + backend deployed together
✅ **Free tier generous** - 125k invocations/month, 100 hours runtime
✅ **Easy rollbacks** - One-click rollback in Netlify dashboard

#### 8. Limitations

⚠️ **Function timeout:** 10 seconds (free), 26 seconds (Pro)
⚠️ **Cold starts:** 1-2 seconds for first request after inactivity
⚠️ **Memory limit:** 1024 MB
⚠️ **No long-lived connections:** Each invocation is stateless

---

### Production Considerations

1. **Rate Limiting:**
   - Replace in-memory store with Redis
   - Implement distributed rate limiting
   - Add per-route limits

2. **Logging:**
   - Use Winston or Pino for structured logging
   - Send logs to centralized service (CloudWatch, Datadog)
   - Implement log rotation

3. **Security:**
   - Enable HTTPS
   - Implement authentication middleware
   - Add request validation
   - Set security headers (helmet.js)
   - Implement CSRF protection

4. **Performance:**
   - Enable compression middleware
   - Implement response caching
   - Optimize database queries
   - Add database query logging
   - Monitor connection pool usage

5. **Backup:**
   - Automated database backups
   - Test restore procedures
   - Document recovery process

---

## Appendix

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3001 | Server port |
| NODE_ENV | No | development | Environment (development/production) |
| FRONTEND_URL | Yes | - | Frontend origin for CORS |
| ANTHROPIC_API_KEY | Yes | - | Anthropic API key for AI features |
| DB_HOST | Yes | - | MySQL host |
| DB_PORT | No | 3306 | MySQL port |
| DB_USER | Yes | - | MySQL username |
| DB_PASSWORD | Yes | - | MySQL password |
| DB_NAME_PROD | Yes | - | Production database name |
| DB_NAME_DEV | Yes | - | Development database name |
| DB_NAME_INVENTORY | Yes | - | Inventory database name |
| DB_SSL_CA | No | - | Path to SSL CA certificate |

---

### API Endpoint Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/ros` | GET | Get all ROs |
| `/api/ros/:id` | GET | Get single RO |
| `/api/ros` | POST | Create RO |
| `/api/ros/:id` | PATCH | Update/archive RO |
| `/api/ros/:id` | DELETE | Delete RO |
| `/api/ros/stats/dashboard` | GET | Dashboard stats |
| `/api/inventory/search` | GET | Search inventory |
| `/api/inventory/table/:name` | GET | Get table items |
| `/api/inventory/low-stock` | GET | Low stock items |
| `/api/inventory/decrement` | POST | Decrement qty |
| `/api/ai/chat` | POST | AI chat |
| `/api/ai/health` | GET | AI status |
| `/api/ai-logs` | GET/POST | Conversation logs |
| `/api/ai-logs/:id` | DELETE | Delete log |
| `/api/ai-logs/conversation/:id` | GET | Get conversation |

---

### Common Patterns

**Pagination:**
```javascript
// Request
GET /api/ai-logs?limit=50&offset=100

// Implementation
const limit = parseInt(req.query.limit) || 50;
const offset = parseInt(req.query.offset) || 0;
const [rows] = await pool.query(
  'SELECT * FROM ai_conversation_logs LIMIT ? OFFSET ?',
  [limit, offset]
);
```

**Date Filtering:**
```javascript
// Request
GET /api/ai-logs?startDate=2024-11-01&endDate=2024-11-30

// Implementation
let query = 'SELECT * FROM ai_conversation_logs WHERE 1=1';
const params = [];

if (startDate) {
  query += ' AND timestamp >= ?';
  params.push(startDate);
}

if (endDate) {
  query += ' AND timestamp <= ?';
  params.push(endDate);
}

const [rows] = await pool.query(query, params);
```

---

**Document End**

For questions or updates, refer to:
- Main documentation: `.claude/CLAUDE.md`
- Architecture: `.claude/architecture.md`
- Frontend workflow: See `repair-dashboard/` README
