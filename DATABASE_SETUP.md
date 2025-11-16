# Database Setup - Production vs Development

## Overview

The GenThrust Repair Order Tracker uses **two separate MySQL databases**:

- **`ro_tracker_prod`** - Production database for live data
- **`ro_tracker_dev`** - Development database for testing

This separation ensures that testing and development work never affects real production data.

## Database Structure

Both databases have identical schemas:

### Tables

1. **`ai_conversation_logs`** - Stores AI Assistant conversation history
   - `id` - Auto-increment primary key
   - `conversation_id` - UUID grouping related messages
   - `timestamp` - When the message was sent
   - `user` - Email of the user
   - `user_message` - What the user asked
   - `ai_response` - What the AI responded
   - `success` - Whether the operation succeeded
   - `error` - Error message if failed
   - `model` - AI model used (e.g., claude-sonnet-4)
   - `duration_ms` - How long the AI took to respond
   - `context_ro_count` - Number of ROs in context

## Switching Between Databases

The database selection is controlled by the **`NODE_ENV`** environment variable in `backend/.env`:

### Development Mode (Default)

```bash
NODE_ENV=development
```

- Uses: `ro_tracker_dev`
- Pre-populated with test data
- Safe for testing and development
- Changes don't affect production

### Production Mode

```bash
NODE_ENV=production
```

- Uses: `ro_tracker_prod`
- Contains real business data
- Use only when deploying to production
- **⚠️ Be careful! Changes affect real data**

## Setup Instructions

### Initial Setup

1. **Run the setup script** (creates both databases):
   ```bash
   cd backend
   mysql -u root -pGen@2026 < setup_databases.sql
   ```

2. **Verify databases were created**:
   ```bash
   mysql -u root -pGen@2026 -e "SHOW DATABASES;"
   ```

   You should see:
   - `ro_tracker_dev`
   - `ro_tracker_prod`
   - `genthrust_inventory` (legacy)

3. **Start the backend**:
   ```bash
   cd backend
   npm start
   ```

   Check the console output:
   ```
   [Database] Environment: development
   [Database] Using database: ro_tracker_dev
   ```

### Switching to Production

1. **Edit `backend/.env`**:
   ```bash
   # Change this line:
   NODE_ENV=production
   ```

2. **Restart the backend**:
   ```bash
   # Kill the current server (Ctrl+C)
   npm start
   ```

3. **Verify production mode**:
   ```
   [Database] Environment: production
   [Database] Using database: ro_tracker_prod
   ```

## API Endpoints

### AI Conversation Logs

All endpoints are available at `http://localhost:3001/api/ai-logs`

#### Save Log
```http
POST /api/ai-logs
Content-Type: application/json

{
  "conversationId": "uuid-here",
  "user": "cmalagon@genthrust.net",
  "userMessage": "Show me all active ROs",
  "aiResponse": "I found 42 active repair orders...",
  "success": true,
  "model": "claude-sonnet-4",
  "durationMs": 1250,
  "contextRoCount": 100
}
```

#### Get Logs
```http
GET /api/ai-logs?limit=50&offset=0&user=cmalagon@genthrust.net
```

#### Get Conversation
```http
GET /api/ai-logs/conversation/uuid-here
```

#### Get Statistics
```http
GET /api/ai-logs/stats
```

#### Delete Log
```http
DELETE /api/ai-logs/123
```

#### Delete User Logs
```http
DELETE /api/ai-logs/user/cmalagon@genthrust.net
```

## Inventory Database

The system maintains a **separate legacy inventory database** (`genthrust_inventory`) for backward compatibility. This database contains:

- `inventoryindex` (6,571 rows)
- `stock_room` (1,071 rows)
- `bins_inventory` (4,275 rows)
- Other inventory tables

The inventory database is **NOT affected** by the `NODE_ENV` setting - it always uses `genthrust_inventory`.

## Best Practices

### Development

1. ✅ Always use `NODE_ENV=development` for local development
2. ✅ Test new features in dev database first
3. ✅ Populate dev database with realistic test data
4. ✅ Clear dev database logs periodically:
   ```sql
   USE ro_tracker_dev;
   TRUNCATE TABLE ai_conversation_logs;
   ```

### Production

1. ⚠️ Only use `NODE_ENV=production` when deploying to production
2. ⚠️ Never manually modify production data without backups
3. ⚠️ Create backups before major changes:
   ```bash
   mysqldump -u root -pGen@2026 ro_tracker_prod > backup_$(date +%Y%m%d).sql
   ```
4. ⚠️ Monitor production logs regularly

## Troubleshooting

### Database Connection Errors

**Error**: `Access denied for user 'root'@'localhost'`

**Solution**: Check your password in `backend/.env`:
```bash
DB_PASSWORD=Gen@2026
```

### Wrong Database Selected

**Error**: Table doesn't exist

**Solution**: Check the server startup logs:
```
[Database] Environment: development
[Database] Using database: ro_tracker_dev
```

If it's using the wrong database, update `NODE_ENV` in `backend/.env`

### Test Data Missing in Dev

**Solution**: Re-run the setup script:
```bash
mysql -u root -pGen@2026 < backend/setup_databases.sql
```

This will recreate the test data in `ro_tracker_dev`

## Migrating from Legacy System

If you need to migrate existing inventory data from `genthrust_inventory`:

1. **Backup first**:
   ```bash
   mysqldump -u root -pGen@2026 genthrust_inventory > genthrust_inventory_backup.sql
   ```

2. **Copy to production**:
   ```sql
   USE ro_tracker_prod;

   -- Copy inventory tables
   INSERT INTO stock_room SELECT * FROM genthrust_inventory.stock_room;
   INSERT INTO bins_inventory SELECT * FROM genthrust_inventory.bins_inventory;
   INSERT INTO inventoryindex SELECT * FROM genthrust_inventory.inventoryindex;
   ```

3. **Verify**:
   ```sql
   SELECT COUNT(*) FROM ro_tracker_prod.stock_room;
   SELECT COUNT(*) FROM ro_tracker_prod.bins_inventory;
   ```

## Summary

| Environment | Database | Purpose | Default |
|------------|----------|---------|---------|
| Development | `ro_tracker_dev` | Testing, development | ✅ Yes |
| Production | `ro_tracker_prod` | Live business data | ❌ No |
| Inventory | `genthrust_inventory` | Legacy inventory (shared) | Always |

**Remember**: Development is the default and safest mode for testing!
