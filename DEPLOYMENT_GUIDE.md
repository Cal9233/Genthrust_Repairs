# GenThrust RO Tracker - Production Deployment Guide

This guide will help you deploy your application to production using Netlify (frontend and backend via Netlify Functions).

---

## Prerequisites

- [x] GitHub account
- [x] Netlify account (already set up)
- [x] MySQL database accessible from the internet (using Aiven Cloud)

---

## Step 1: Backend Deployment (Netlify Functions)

The backend is now deployed as **Netlify Functions** (serverless), automatically deployed alongside the frontend.

### 1.1 Backend Structure

```
netlify/
  └── functions/
      └── api.js    # Serverless wrapper for Express app
backend/
  ├── app.js        # Express application
  ├── server.js     # Local development server
  └── routes/       # API routes
```

**How it works:**
- Local development: `npm start` runs Express on `http://localhost:3001`
- Production: Netlify Functions wraps Express app and deploys to `/.netlify/functions/api`

### 1.2 Configure Backend Environment Variables on Netlify

1. Go to https://app.netlify.com
2. Select your site: **genthrust-repairs**
3. Go to **Site Settings** → **Environment Variables**
4. Add the following **backend** environment variables:

```bash
# Required - Anthropic AI API Key
ANTHROPIC_API_KEY=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

# Required - Frontend URL for CORS
FRONTEND_URL=https://genthrust-repairs.netlify.app

# Database Configuration (Aiven Cloud MySQL)
DB_HOST=genthrust-inventory-genthrust2017.b.aivencloud.com
DB_PORT=27562
DB_USER=avnadmin
DB_PASSWORD=your-aiven-password
DB_NAME=genthrust_inventory
DB_SSL_MODE=REQUIRED

# Optional - Port (only used for local dev)
PORT=3001
```

5. Click **"Save"**
6. Netlify will automatically redeploy

### 1.3 Backend URL

Your backend API is accessible at:

```
https://genthrust-repairs.netlify.app/.netlify/functions/api
```

All API routes are prefixed with `/.netlify/functions/api`, for example:
- Health check: `/.netlify/functions/api/health`
- Inventory search: `/.netlify/functions/api/inventory/search`
- AI proxy: `/.netlify/functions/api/ai/chat`

### 1.4 Test Backend Health Check

Visit: `https://genthrust-repairs.netlify.app/.netlify/functions/api/health`

You should see:

```json
{ "status": "ok", "message": "Genthrust Repairs API is running" }
```

---

## Step 2: Configure Frontend Environment Variables

### 2.1 Add Frontend Environment Variables

Add the following **frontend** environment variables (if not already added from Step 1.2):

| Variable Name                | Value                                                               |
| ---------------------------- | ------------------------------------------------------------------- |
| `VITE_CLIENT_ID`             | `ee8cb926-5dda-4bbf-9360-dd94d7c433e1`                              |
| `VITE_TENANT_ID`             | `ddb0202c-cb5f-425e-891a-5666e58d9ad5`                              |
| `VITE_BACKEND_URL`           | `https://genthrust-repairs.netlify.app/.netlify/functions/api`     |
| `VITE_API_BASE_URL`          | `https://genthrust-repairs.netlify.app/.netlify/functions/api`     |
| `VITE_SHAREPOINT_SITE_URL`   | `https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite` |
| `VITE_EXCEL_FILE_NAME`       | `Book.xlsx`                                                         |
| `VITE_EXCEL_TABLE_NAME`      | `Repairs`                                                           |
| `VITE_SHOP_TABLE_NAME`       | `Table3`                                                            |
| `VITE_INVENTORY_WORKBOOK_ID` | `01RD47DPWM335G2HPETNDZ5YGZIGVO4BYY`                                |

**IMPORTANT:** The backend URL points to Netlify Functions, not a separate backend server.

**DO NOT ADD:** `VITE_ANTHROPIC_API_KEY` (security risk - API key is stored in backend environment only!)

### 2.3 Trigger Redeploy

1. Go to **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait for build to complete (2-3 minutes)

---

## Step 3: Commit and Push Deployment Files

These files are configured for Netlify deployment:

```bash
# Commit deployment updates
git add netlify.toml netlify/functions/api.js repair-dashboard/.env.local backend/.env DEPLOYMENT_GUIDE.md
git commit -m "feat: migrate to Netlify Functions deployment

- Update netlify.toml for Netlify Functions configuration
- Add netlify/functions/api.js serverless wrapper
- Update DEPLOYMENT_GUIDE.md with Netlify Functions instructions
- Configure environment variables for Aiven Cloud MySQL
- Remove Render.com deployment files"
git push origin main
```

---

## Step 4: Database Configuration (Aiven Cloud MySQL)

### Current Setup: Aiven Cloud MySQL

The project is configured to use **Aiven Cloud MySQL** for inventory data:

**Connection Details:**
- Host: `genthrust-inventory-genthrust2017.b.aivencloud.com`
- Port: `27562`
- User: `avnadmin`
- Database: `genthrust_inventory`
- SSL/TLS: **Required**

**Environment Variables (already configured in Step 1.2):**
```bash
DB_HOST=genthrust-inventory-genthrust2017.b.aivencloud.com
DB_PORT=27562
DB_USER=avnadmin
DB_PASSWORD=your-aiven-password
DB_NAME=genthrust_inventory
DB_SSL_MODE=REQUIRED
```

### Alternative: Local MySQL (Development Only)

For local development without Aiven:

- AI features will work (uses Anthropic API)
- **Inventory search will NOT work** (requires cloud MySQL)
- Excel/SharePoint features will work (uses Microsoft Graph API)

**To use local MySQL for development:**
1. Update `backend/.env` with local MySQL credentials
2. Remove `DB_SSL_MODE` or set to `DISABLED`
3. Ensure `DB_PORT` is `3306` (default MySQL port)

---

## Step 5: Test Your Deployment

### 5.1 Test Frontend

1. Visit: https://genthrust-repairs.netlify.app
2. You should see the login page
3. Click "Sign in with Microsoft"
4. Authenticate with Azure AD
5. You should see the dashboard

### 5.2 Test AI Features

1. Press **Ctrl+K** or click **"AI Assistant"** button
2. Type: "Hello"
3. AI should respond (confirms backend is connected)

### 5.3 Test Inventory Search (if MySQL configured)

1. Click **"Inventory"** tab
2. Search for a part number
3. Results should appear (confirms MySQL backend works)

---

## Troubleshooting

### Issue: "Application Error" on Netlify

**Cause:** Missing or incorrect environment variables

**Fix:**

1. Check all `VITE_*` variables are set in Netlify
2. Ensure `VITE_CLIENT_ID` and `VITE_TENANT_ID` are correct
3. Redeploy after adding variables

### Issue: AI Assistant Not Working

**Cause:** Backend not accessible or API key missing

**Fix:**

1. Check Netlify Functions are deployed: `https://genthrust-repairs.netlify.app/.netlify/functions/api/health`
2. Verify `ANTHROPIC_API_KEY` is set in Netlify environment variables
3. Check `VITE_BACKEND_URL` in Netlify matches `/.netlify/functions/api`
4. Check Netlify Functions logs for errors

### Issue: Inventory Search Not Working

**Cause:** Aiven MySQL database not accessible or credentials incorrect

**Fix:**

1. Verify Aiven MySQL database is running (check Aiven console)
2. Check database credentials in Netlify environment variables
3. Ensure `DB_SSL_MODE=REQUIRED` is set
4. Verify `DB_PORT=27562` (not the default 3306)

### Issue: Login Fails / Redirect Error

**Cause:** Azure AD redirect URI mismatch

**Fix:**

1. Go to https://portal.azure.com
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your app (Client ID: `ee8cb926-5dda-4bbf-9360-dd94d7c433e1`)
4. Add redirect URI: `https://genthrust-repairs.netlify.app`
5. Save and retry login

---

## Free Tier Limitations

### Netlify (Frontend + Backend Functions)

**Free tier includes:**
- **100 GB bandwidth/month**
- **300 build minutes/month**
- **125,000 serverless function invocations/month**
- **100 hours of serverless function runtime/month**

**Limitations:**
- Function execution time: Max 10 seconds per invocation (26 seconds on Pro plan)
- Function memory: 1024 MB
- Cold starts: Functions may take 1-2 seconds to warm up on first request

**Tip:** Netlify's free tier is generous for most use cases. Upgrade to Pro ($19/month) if you need longer function timeouts or more invocations.

### Aiven Cloud (MySQL Database)

**Free tier includes:**
- **1 free MySQL service** (limited resources)
- **Automatic backups**
- **SSL/TLS encryption**

**Limitations:**
- Storage: Limited on free tier
- Compute: Shared resources

**Tip:** Monitor your database usage in the Aiven console to ensure you stay within free tier limits.

---

## Next Steps

1. **Set up Azure AD redirect URIs** for production domain
2. **Configure CORS** in backend to allow Netlify domain (already configured in backend/app.js)
3. **Set up monitoring** (optional): Use Netlify Functions logs or external service
4. **Database backup** (recommended): Aiven provides automatic backups, verify they're enabled
5. **Custom domain** (optional): Add your own domain to Netlify

---

## Deployment Files

- ✅ `netlify.toml` - Netlify build and Functions configuration
- ✅ `netlify/functions/api.js` - Serverless wrapper for Express backend
- ✅ `backend/app.js` - Express application (deployed as Netlify Function)
- ✅ `repair-dashboard/.env.local` - Local development environment variables
- ✅ `backend/.env` - Backend environment variables (local)
- ✅ `DEPLOYMENT_GUIDE.md` - This file

---

## Security Checklist

- [x] `ANTHROPIC_API_KEY` stored only in backend (not exposed in frontend)
- [x] Database credentials stored only in backend environment
- [x] `.env` files added to `.gitignore` (never committed)
- [ ] Azure AD app configured with correct redirect URIs
- [ ] MySQL uses strong password and restricted access
- [ ] CORS properly configured to allow only your Netlify domain

---

## Support

If you encounter issues not covered in this guide:

1. Check Netlify Functions logs: Dashboard → Functions → [Function Name] → Logs
2. Check Netlify deploy logs: Dashboard → Deploys → [Latest Deploy] → Deploy log
3. Check browser console for frontend errors (F12 → Console tab)
4. Review backend health: `https://genthrust-repairs.netlify.app/.netlify/functions/api/health`
5. Check Aiven database status: Aiven console → Services → genthrust-inventory

---

**Version:** 2.0
**Last Updated:** 2025-11-24
**Deployment Platform:** Netlify (Frontend + Functions) + Aiven Cloud (MySQL)
**Deployment Status:** Migrated to serverless architecture
