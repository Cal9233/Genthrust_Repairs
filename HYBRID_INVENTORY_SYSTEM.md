# Hybrid Inventory System - MySQL with SharePoint Fallback

## Overview

The Genthrust Repairs application now uses a **hybrid inventory system** that combines the best of both worlds:

- **Primary**: MySQL database backend for fast, reliable access
- **Fallback**: SharePoint/Excel Online for redundancy and compatibility

The system automatically switches between data sources based on availability, ensuring maximum uptime and reliability.

## Architecture

```
┌─────────────────────┐
│   React Frontend    │
│  (repair-dashboard) │
└──────────┬──────────┘
           │
           │ Uses inventoryService
           │
           ▼
┌─────────────────────────────────────┐
│  Hybrid Inventory Service           │
│  (inventoryService.ts)              │
│  • Tries MySQL first                │
│  • Falls back to SharePoint on error│
└──────┬──────────────────┬───────────┘
       │                  │
       │ Primary          │ Fallback
       ▼                  ▼
┌──────────────┐   ┌────────────────────┐
│ MySQL API    │   │  SharePoint API    │
│ (Backend)    │   │  (Microsoft Graph) │
└──────┬───────┘   └─────────┬──────────┘
       │                     │
       ▼                     ▼
┌──────────────┐   ┌────────────────────┐
│    MySQL     │   │  SharePoint Excel  │
│   Database   │   │    Workbook        │
└──────────────┘   └────────────────────┘
```

## Data Flow

### Normal Operation (MySQL Available)

1. Frontend requests inventory data
2. Hybrid service checks MySQL health (cached for 60 seconds)
3. If healthy, MySQL service makes API call
4. Backend queries MySQL database
5. Results returned to frontend

### Fallback Mode (MySQL Unavailable)

1. Frontend requests inventory data
2. Hybrid service detects MySQL is down
3. Automatically switches to SharePoint service
4. SharePoint service uses Microsoft Graph API
5. Results returned to frontend

## File Structure

### Backend
```
backend/
├── server.js                    # Express server (port 3001)
├── config/
│   └── database.js              # MySQL connection pool
├── routes/
│   └── inventory.js             # REST API endpoints
└── .env                         # Database credentials
```

### Frontend Services
```
src/services/
├── inventoryService.ts          # Hybrid service (main interface)
├── mysqlInventoryService.ts     # MySQL API client
└── sharepointInventoryService.ts # SharePoint/Graph API client
```

## Configuration

### Backend (.env)
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Gen@2026
DB_NAME=genthrust_inventory
PORT=3001
```

### Frontend (.env.local)
```bash
# MySQL Backend API
VITE_API_BASE_URL=http://localhost:3001/api

# SharePoint (Fallback)
VITE_SHAREPOINT_SITE_URL=https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite
VITE_INVENTORY_WORKBOOK_ID=01RD47DPWM335G2HPETNDZ5YGZIGVO4BYY
```

## API Endpoints

All endpoints are available at `http://localhost:3001/api/inventory`

### GET /search
Search for parts by part number
```
GET /search?partNumber=387
Response: Array of InventorySearchResult
```

### GET /stats
Get inventory statistics
```
GET /stats
Response: {
  totalItems: number,
  totalQuantity: number,
  lowStockCount: number,
  recentTransactions: number
}
```

### GET /stock-room
Get stock room inventory with filters
```
GET /stock-room?location=B12&condition=NEW&search=lamp
```

### GET /bins
Get bins inventory with filters
```
GET /bins?location=1N&bin=3&search=lamp
```

### POST /decrement
Decrement inventory quantity
```
POST /decrement
Body: {
  indexId: string,
  partNumber: string,
  roNumber?: string,
  notes?: string
}
```

## Health Check & Fallback Logic

The hybrid service implements intelligent health checking:

1. **Health Check Interval**: Every 60 seconds
2. **Endpoint**: `GET http://localhost:3001/health`
3. **Automatic Fallback**: If MySQL fails, immediately switch to SharePoint
4. **Recovery**: Next health check will retry MySQL

### Manual Health Check

You can force a health check programmatically:
```typescript
await inventoryService.forceHealthCheck();
```

### Check Current Data Source

```typescript
const status = inventoryService.getDataSourceStatus();
// { current: 'mysql' | 'sharepoint', mysqlAvailable: boolean }
```

## Database Schema

### Tables
- `inventoryindex` - Master index (6,571 rows)
- `stock_room` - Stock room inventory (1,071 rows)
- `bins_inventory` - Bins inventory (4,275 rows)
- `md82_parts`, `727_parts`, `terra`, etc.
- `transactions` - Transaction log

### Stock Room Columns
```
PN, SERIAL, DESCRIPTION, QTY, LOCATION, COND,
TAG_DATE, TALLER, PO_COST, INFO, RO_COST,
TOTAL_COST, QUOTE_PRICE, COMMENT, DOC_8130
```

## Running the System

### Start Backend
```bash
cd backend
npm start
# Server starts on http://localhost:3001
```

### Start Frontend
```bash
cd repair-dashboard
npm run dev
# Frontend starts on http://localhost:5173 (or similar)
```

## Monitoring & Logs

### Console Logs

The hybrid service provides detailed logging:

```
[Hybrid Inventory] ✓ MySQL backend is available
[Hybrid Inventory] Attempting searchInventory via MySQL
[Hybrid Inventory] ✓ searchInventory successful via MySQL
```

Or when falling back:

```
[Hybrid Inventory] ⚠ MySQL health check failed: ...
[Hybrid Inventory] Falling back to SharePoint for searchInventory
[Hybrid Inventory] ✓ searchInventory successful via SharePoint
```

## Advantages

### MySQL Primary
- **Fast**: Direct database queries, no API rate limits
- **Reliable**: Local control, no external dependencies
- **Scalable**: Can handle many concurrent requests
- **Searchable**: Full SQL query capabilities

### SharePoint Fallback
- **Always Available**: Cloud-hosted by Microsoft
- **No Local Infrastructure**: Works even if MySQL is down
- **Existing Integration**: Already configured and working
- **Data Consistency**: Single source of truth

## Troubleshooting

### MySQL Not Connecting

1. Check if MySQL service is running
2. Verify credentials in `backend/.env`
3. Ensure backend server is started
4. Check firewall settings for port 3001

### SharePoint Fallback Not Working

1. Verify Azure AD authentication
2. Check SharePoint permissions
3. Ensure `VITE_INVENTORY_WORKBOOK_ID` is correct
4. Test Microsoft Graph API access

### Both Sources Failing

Check console for error messages:
```
[Hybrid Inventory] ✗ Both MySQL and SharePoint failed for searchInventory
```

This indicates a critical issue - check network connectivity and credentials.

## Best Practices

1. **Keep Backend Running**: Start backend before frontend
2. **Monitor Logs**: Watch console for data source switches
3. **Test Fallback**: Occasionally stop MySQL to verify SharePoint works
4. **Update Both Sources**: Keep MySQL and SharePoint in sync (if needed)

## Future Enhancements

- [ ] Automatic MySQL → SharePoint sync
- [ ] Real-time health monitoring dashboard
- [ ] Performance metrics and analytics
- [ ] Write-through caching layer
- [ ] Multi-region MySQL replication
