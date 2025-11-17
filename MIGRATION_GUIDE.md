# AI Proxy Migration Guide

## Overview

This guide explains how to migrate from the insecure frontend Anthropic API implementation to the secure backend proxy.

**Security Issue Fixed**: The Anthropic API key was previously exposed in the browser bundle, making it accessible to anyone who inspected the frontend code. This has been fixed by moving the API key to the backend.

---

## What Changed

### Before (Insecure)
```
Frontend (Browser) → Anthropic API directly
├── API key exposed in browser bundle (SECURITY RISK)
└── No rate limiting
```

### After (Secure)
```
Frontend (Browser) → Backend Proxy → Anthropic API
├── API key stored securely on backend only
├── Rate limiting: 3 requests/minute per user
└── Request validation and error handling
```

---

## Migration Steps

### 1. Backend Setup

#### Step 1.1: Create Backend Environment File

```bash
cd backend
cp .env.example .env
```

#### Step 1.2: Add Your Anthropic API Key

Edit `backend/.env` and add your API key:

```env
# Anthropic AI Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:5173

# Database Configuration (if not already set)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_database_password
DB_NAME_PROD=ro_tracker_prod
DB_NAME_DEV=ro_tracker_dev
DB_INVENTORY_NAME=genthrust_inventory
```

**IMPORTANT**:
- Never commit `.env` to version control
- Get your API key from: https://console.anthropic.com/settings/keys
- The API key format is: `sk-ant-api03-...`

#### Step 1.3: Install Dependencies

```bash
cd backend
npm install
```

This installs the `@anthropic-ai/sdk` package (v0.69.0) which is now required on the backend.

#### Step 1.4: Start Backend Server

```bash
cd backend
npm start
# or for development with auto-reload:
npm run dev
```

You should see:
```
[Server] Genthrust Repairs API running on port 3001
[Server] AI Proxy API: http://localhost:3001/api/ai
```

#### Step 1.5: Test Backend Health

```bash
curl http://localhost:3001/api/ai/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "AI proxy is ready",
  "model": "claude-3-5-sonnet-20241022",
  "rateLimit": {
    "maxRequests": 3,
    "windowSeconds": 60
  }
}
```

---

### 2. Frontend Setup

#### Step 2.1: Create Frontend Environment File

```bash
cd repair-dashboard
```

Create `.env.local` (or `.env`) with:

```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001

# Remove this - NO LONGER NEEDED (security risk)
# VITE_ANTHROPIC_API_KEY=...

# Your existing SharePoint/Microsoft config
VITE_CLIENT_ID=your-azure-client-id
VITE_TENANT_ID=your-azure-tenant-id
VITE_SHAREPOINT_SITE_URL=your-sharepoint-site-url
VITE_EXCEL_FILE_NAME=Book.xlsx
VITE_EXCEL_TABLE_NAME=Repairs
VITE_SHOPS_FILE_NAME=shops.xlsx
VITE_SHOPS_TABLE_NAME=Shops
VITE_STORAGE_TYPE=sharepoint
```

#### Step 2.2: Remove Frontend Anthropic SDK (Optional)

The frontend no longer uses `@anthropic-ai/sdk` directly. You can optionally remove it:

```bash
cd repair-dashboard
npm uninstall @anthropic-ai/sdk
```

This will reduce your frontend bundle size.

#### Step 2.3: Install Frontend Dependencies

```bash
cd repair-dashboard
npm install
```

#### Step 2.4: Start Frontend Development Server

```bash
cd repair-dashboard
npm run dev
```

---

### 3. Verification

#### Step 3.1: Test AI Chat Functionality

1. Open the application in your browser (http://localhost:5173)
2. Navigate to the AI Assistant (chat icon in navbar)
3. Send a test message: "Show me all repair orders"
4. Verify the AI responds correctly

#### Step 3.2: Check Rate Limiting

Try sending 4 requests quickly within 1 minute. The 4th request should fail with:

```
Rate limit exceeded. Maximum 3 requests per minute. Try again in XX seconds.
```

#### Step 3.3: Monitor Backend Logs

Backend console should show:
```
[AI Proxy] Chat request from user: user@example.com
[AI Proxy] Model: claude-3-5-sonnet-20241022, Messages: 1, Tools: 14
[AI Proxy] Request completed in 2543ms
[AI Proxy] Usage - Input: 4521, Output: 234
```

---

### 4. Production Deployment

#### Step 4.1: Update Environment Variables

**Backend `.env` (production)**:
```env
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-api03-your-production-key
FRONTEND_URL=https://your-production-frontend.com
PORT=3001
```

**Frontend `.env.production`**:
```env
VITE_BACKEND_URL=https://your-production-backend.com
```

#### Step 4.2: Security Checklist

- [ ] Backend `.env` is not committed to git (check `.gitignore`)
- [ ] Frontend no longer has `VITE_ANTHROPIC_API_KEY`
- [ ] CORS is configured with your actual frontend URL
- [ ] Backend is deployed behind HTTPS
- [ ] Frontend is deployed behind HTTPS
- [ ] Rate limiting is enabled and tested

#### Step 4.3: Update CORS for Production

In `backend/server.js`, the CORS configuration reads from `FRONTEND_URL`:

```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
```

Make sure `FRONTEND_URL` is set to your production frontend URL.

---

## Architecture Changes

### Files Modified

#### Backend (New/Modified)
- ✅ **backend/routes/ai.js** - NEW: AI proxy endpoint
- ✅ **backend/server.js** - MODIFIED: Added AI routes and CORS config
- ✅ **backend/.env.example** - NEW: Environment template
- ✅ **backend/package.json** - MODIFIED: Added @anthropic-ai/sdk dependency

#### Frontend (Modified)
- ✅ **src/config/anthropic.ts** - MODIFIED: Removed API key, added backend URL
- ✅ **src/services/anthropicAgent.ts** - MODIFIED: Now calls backend proxy via fetch

---

## API Reference

### Backend Endpoints

#### POST /api/ai/chat

Proxies requests to Anthropic API with rate limiting and validation.

**Request Body**:
```json
{
  "messages": [
    { "role": "user", "content": "Your message" }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "maxTokens": 4096,
  "temperature": 0.7,
  "tools": [...],
  "systemPrompt": "...",
  "userId": "user@example.com"
}
```

**Response** (success):
```json
{
  "success": true,
  "response": {
    "id": "msg_...",
    "type": "message",
    "role": "assistant",
    "content": [...],
    "model": "claude-3-5-sonnet-20241022",
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 4521,
      "output_tokens": 234
    }
  },
  "meta": {
    "duration": 2543,
    "model": "claude-3-5-sonnet-20241022",
    "usage": {...}
  }
}
```

**Response** (rate limit):
```json
{
  "error": "Rate limit exceeded",
  "message": "Maximum 3 requests per minute. Try again in 45 seconds.",
  "retryAfter": 45
}
```

**Response** (validation error):
```json
{
  "error": "Validation error",
  "message": "messages array is required and must not be empty"
}
```

**Rate Limit Headers**:
```
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 2025-11-17T10:30:00.000Z
```

#### GET /api/ai/health

Check if AI proxy is operational.

**Response**:
```json
{
  "status": "ok",
  "message": "AI proxy is ready",
  "model": "claude-3-5-sonnet-20241022",
  "rateLimit": {
    "maxRequests": 3,
    "windowSeconds": 60
  }
}
```

#### POST /api/ai/clear-rate-limit

Clear rate limit for a specific user (admin only).

**Request Body**:
```json
{
  "userId": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Rate limit cleared for user: user@example.com"
}
```

---

## Rate Limiting Configuration

Default configuration in `backend/routes/ai.js`:

```javascript
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;    // 3 requests per minute
```

To adjust limits, modify these constants in the route file.

**Production Recommendations**:
- Standard users: 3-5 requests/minute
- Power users: 10 requests/minute
- Consider implementing user-based tiers
- For production, use Redis instead of in-memory storage

---

## Troubleshooting

### Issue: "Backend URL not configured"

**Solution**: Add `VITE_BACKEND_URL` to frontend `.env.local`:
```env
VITE_BACKEND_URL=http://localhost:3001
```

### Issue: "Anthropic API key not configured"

**Solution**: Add `ANTHROPIC_API_KEY` to backend `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### Issue: "CORS error" in browser console

**Solution**:
1. Check backend is running on correct port (3001)
2. Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
3. Check browser console for exact CORS error

### Issue: Rate limit stuck/not resetting

**Solution**: Restart the backend server. In production, implement Redis-based rate limiting for persistence across server restarts.

### Issue: "Failed to connect to AI backend"

**Solution**:
1. Verify backend is running: `curl http://localhost:3001/health`
2. Check backend logs for errors
3. Verify firewall/network allows connection

---

## Rollback Plan

If you need to rollback to the old implementation:

1. Restore `VITE_ANTHROPIC_API_KEY` to frontend `.env`
2. Reinstall frontend Anthropic SDK: `npm install @anthropic-ai/sdk@^0.68.0`
3. Revert `src/services/anthropicAgent.ts` to git history
4. Revert `src/config/anthropic.ts` to git history

```bash
git checkout HEAD~1 -- repair-dashboard/src/services/anthropicAgent.ts
git checkout HEAD~1 -- repair-dashboard/src/config/anthropic.ts
```

**Note**: Rollback is NOT recommended due to security implications.

---

## Security Benefits

### Before (Vulnerable)
- ❌ API key visible in browser DevTools
- ❌ API key in bundled JavaScript (publicly accessible)
- ❌ No rate limiting (vulnerable to abuse)
- ❌ No request validation
- ❌ Client-side API costs (anyone can use your key)

### After (Secure)
- ✅ API key only on backend server
- ✅ Rate limiting prevents abuse (3 req/min per user)
- ✅ Request validation prevents malformed requests
- ✅ Centralized error handling and logging
- ✅ Can add authentication/authorization easily
- ✅ Can monitor usage and costs server-side

---

## Next Steps

### Recommended Enhancements

1. **Implement Redis for Rate Limiting**
   - Current: In-memory (resets on server restart)
   - Better: Redis-based persistent rate limiting

2. **Add Authentication Middleware**
   - Verify user identity before allowing AI requests
   - Integrate with MSAL token validation

3. **Usage Tracking**
   - Track token usage per user
   - Set budget limits per user/organization
   - Alert on excessive usage

4. **Monitoring & Alerts**
   - Add Sentry or similar for error tracking
   - Monitor API latency and errors
   - Alert on rate limit violations

5. **Caching**
   - Cache common queries to reduce API costs
   - Implement semantic caching for similar questions

---

## Support

If you encounter issues during migration:

1. Check backend logs: `cd backend && npm run dev`
2. Check frontend console in browser DevTools
3. Verify environment variables are set correctly
4. Test backend health endpoint: `curl http://localhost:3001/api/ai/health`

For additional help, review:
- Backend route: `backend/routes/ai.js`
- Frontend agent: `repair-dashboard/src/services/anthropicAgent.ts`
- This migration guide

---

**Migration completed successfully!** 🎉

Your Anthropic API key is now secure and only accessible from the backend server.
