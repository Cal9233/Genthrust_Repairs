# Genthrust Repairs Backend API

Node.js/Express backend API for Genthrust Repairs inventory management system.

## Features

- RESTful API for inventory management
- MySQL database integration
- CORS enabled for frontend communication
- Real-time inventory search and tracking
- Transaction logging

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Gen@2026
DB_NAME=genthrust_inventory
PORT=3001
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Health Check
- `GET /health` - Check if API is running

### Inventory

#### Search Inventory
- `GET /api/inventory/search?partNumber=<part_number>`
- Returns all matching inventory items

#### Get Stock Room Inventory
- `GET /api/inventory/stock-room?location=<loc>&condition=<cond>&search=<term>`
- Optional filters: location, condition, search term

#### Get Bins Inventory
- `GET /api/inventory/bins?location=<loc>&bin=<bin>&search=<term>`
- Optional filters: location, bin, search term

#### Get Table Data
- `GET /api/inventory/table/:tableName`
- Valid tables: bins_inventory, stock_room, md82_parts, 727_parts, etc.

#### Get Statistics
- `GET /api/inventory/stats`
- Returns total items, quantity, low stock count, recent transactions

#### Decrement Inventory
- `POST /api/inventory/decrement`
- Body: `{ indexId, partNumber, roNumber?, notes? }`
- Decrements quantity and logs transaction

#### Get All Tables
- `GET /api/inventory/tables`
- Returns list of all tables with row counts

## Database Schema

Connects to MySQL database `genthrust_inventory` with tables:
- `inventoryindex` - Master index of all inventory
- `bins_inventory` - Bin storage inventory
- `stock_room` - Stock room inventory
- `md82_parts` - MD82 aircraft parts
- `727_parts` - 727 aircraft parts
- `transactions` - Transaction log
- Additional regional inventory tables

## Error Handling

All endpoints return appropriate HTTP status codes:
- 200: Success
- 400: Bad request
- 404: Not found
- 500: Server error

Error responses include:
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Development

The server runs on port 3001 by default. The frontend should make API calls to:
```
http://localhost:3001/api/inventory
```
