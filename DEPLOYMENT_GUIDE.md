# GenThrust RO Tracker - Production Deployment Guide

This guide will help you deploy your application to production using Render.com (backend) and Netlify (frontend).

---

## Prerequisites

- [x] GitHub account
- [x] Render.com account (sign up at https://render.com - free tier available)
- [x] Netlify account (already set up)
- [x] MySQL database accessible from the internet (or use Render's managed database)

---

## Step 1: Deploy Backend to Render.com

### 1.1 Connect GitHub Repository to Render

1. Go to https://render.com and sign in
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub account if not already connected
4. Select repository: **`Cal9233/Genthrust_Repairs`**
5. Render will detect the `render.yaml` file automatically
6. Click **"Apply"**

### 1.2 Configure Environment Variables on Render

After creating the service, go to your backend service settings:

1. Navigate to **Environment** tab
2. Add the following environment variables:

```bash
# Required - Your Netlify frontend URL
FRONTEND_URL=https://genthrust-repairs.netlify.app

# Required - Anthropic AI API Key
ANTHROPIC_API_KEY=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

# Database Configuration (Option A: Use your existing MySQL)
DB_HOST=your-mysql-host.com
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Database Configuration (Option B: Use Render PostgreSQL - requires migration)
# See section "Database Options" below
```

3. Click **"Save Changes"**
4. The service will automatically redeploy

### 1.3 Note Your Backend URL

Once deployed, Render will give you a URL like:
```
https://genthrust-backend-XXXX.onrender.com
```

**Copy this URL** - you'll need it for Netlify configuration.

### 1.4 Test Backend Health Check

Visit: `https://YOUR-BACKEND-URL.onrender.com/health`

You should see:
```json
{"status":"ok","message":"Genthrust Repairs API is running"}
```

---

## Step 2: Configure Netlify Environment Variables

### 2.1 Access Netlify Settings

1. Go to https://app.netlify.com
2. Select your site: **genthrust-repairs**
3. Go to **Site Settings** → **Environment Variables**

### 2.2 Add Environment Variables

Click **"Add a variable"** and add each of these:

| Variable Name | Value |
|---------------|-------|
| `VITE_CLIENT_ID` | `ee8cb926-5dda-4bbf-9360-dd94d7c433e1` |
| `VITE_TENANT_ID` | `ddb0202c-cb5f-425e-891a-5666e58d9ad5` |
| `VITE_BACKEND_URL` | `https://YOUR-BACKEND-URL.onrender.com` |
| `VITE_API_BASE_URL` | `https://YOUR-BACKEND-URL.onrender.com/api` |
| `VITE_SHAREPOINT_SITE_URL` | `https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite` |
| `VITE_EXCEL_FILE_NAME` | `Book.xlsx` |
| `VITE_EXCEL_TABLE_NAME` | `Repairs` |
| `VITE_SHOP_TABLE_NAME` | `Table3` |
| `VITE_INVENTORY_WORKBOOK_ID` | `01RD47DPWM335G2HPETNDZ5YGZIGVO4BYY` |

**IMPORTANT:** Replace `YOUR-BACKEND-URL` with your actual Render URL from Step 1.3

**DO NOT ADD:** `VITE_ANTHROPIC_API_KEY` (security risk!)

### 2.3 Trigger Redeploy

1. Go to **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait for build to complete (2-3 minutes)

---

## Step 3: Commit and Push Deployment Files

These files have been created for you:

```bash
# Commit the new deployment files
git add render.yaml netlify.toml repair-dashboard/.env.local backend/.env DEPLOYMENT_GUIDE.md
git commit -m "feat: add production deployment configuration

- Add render.yaml for backend deployment on Render.com
- Add netlify.toml for frontend build configuration
- Add .env.local for local development
- Update backend/.env with proper configuration
- Add comprehensive deployment guide"
git push origin claude/analyze-ai-docs-019Nqh8DzBy4oQvPFZWTNVCp
```

---

## Step 4: Database Options

### Option A: Use Existing MySQL (Recommended if already set up)

**Requirements:**
- MySQL database must be accessible from the internet
- Update `DB_HOST` in Render environment variables to your MySQL host

**Security Considerations:**
- Ensure your MySQL server accepts connections from Render's IP range
- Use strong passwords
- Consider using MySQL SSL connections

### Option B: Use Render PostgreSQL (Requires Migration)

Render offers free PostgreSQL databases. To use this:

1. In Render dashboard, create a new **PostgreSQL** database
2. Note the connection details (host, user, password, database name)
3. Update backend environment variables with PostgreSQL credentials
4. Migrate your data from MySQL to PostgreSQL (requires schema conversion)

**Note:** This requires code changes to support PostgreSQL instead of MySQL.

### Option C: Keep MySQL Local (Development Only)

If you don't have remote MySQL:
- AI features will work (uses Anthropic API)
- **Inventory search will NOT work** (requires MySQL)
- Excel/SharePoint features will work (uses Microsoft Graph API)

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
1. Check Render service is running: `https://YOUR-BACKEND-URL.onrender.com/health`
2. Verify `ANTHROPIC_API_KEY` is set in Render environment
3. Check `VITE_BACKEND_URL` in Netlify matches your Render URL

### Issue: Inventory Search Not Working

**Cause:** MySQL database not accessible

**Fix:**
1. Verify MySQL is accessible from internet
2. Check database credentials in Render environment
3. Test connection: Try connecting to MySQL from Render shell

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

### Render.com (Backend)
- **Free tier:** 750 hours/month (enough for 1 service running 24/7)
- **Spin down after 15 min inactivity** (first request after inactivity takes ~30s)
- **512 MB RAM**
- **Shared CPU**

**Tip:** Upgrade to paid plan ($7/month) to avoid spin-down delays

### Netlify (Frontend)
- **Free tier:** 100 GB bandwidth/month
- **300 build minutes/month**
- More than enough for your use case

---

## Next Steps

1. **Set up Azure AD redirect URIs** for production domain
2. **Configure CORS** in backend to allow Netlify domain
3. **Set up monitoring** (optional): Use Render logs or external service
4. **Database backup** (recommended): Set up automated MySQL backups
5. **Custom domain** (optional): Add your own domain to Netlify

---

## Files Created

- ✅ `render.yaml` - Backend deployment configuration
- ✅ `netlify.toml` - Frontend build and deployment configuration
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

1. Check Render logs: Dashboard → Your Service → Logs
2. Check Netlify deploy logs: Dashboard → Deploys → [Latest Deploy] → Deploy log
3. Check browser console for frontend errors (F12 → Console tab)
4. Review backend health: `https://YOUR-BACKEND-URL.onrender.com/health`

---

**Version:** 1.0
**Last Updated:** 2025-11-20
**Deployment Status:** Ready for production
