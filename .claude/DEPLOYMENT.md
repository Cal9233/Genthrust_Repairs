# DEPLOYMENT.md - Deployment & Setup Guide

## Purpose
Complete deployment and setup guide for GenThrust RO Tracker across all platforms and environments.

**Last Updated:** 2025-11-17
**Status:** Production Ready

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Azure Configuration](#azure-configuration)
4. [SharePoint Setup](#sharepoint-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Mobile (iPhone) Deployment](#mobile-iphone-deployment)
8. [Testing & Verification](#testing--verification)

---

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Azure AD tenant access
- SharePoint Online site
- Git

### Local Development Setup (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/Cal9233/Genthrust_Repairs.git
cd Genthrust_Repairs

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure backend environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Start backend
npm start  # Runs on http://localhost:3001

# 5. Install frontend dependencies (new terminal)
cd ../repair-dashboard
npm install

# 6. Configure frontend environment
cp .env.example .env.local
# Edit .env.local with Azure AD and SharePoint credentials

# 7. Start frontend
npm run dev  # Runs on http://localhost:5173
```

**Access the app:** http://localhost:5173

---

## Environment Setup

### Backend Environment Variables
**File:** `backend/.env`

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=genthrust_inventory

# API Keys
ANTHROPIC_API_KEY=sk-ant-xxxxx

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Frontend Environment Variables
**File:** `repair-dashboard/.env.local`

```env
# Azure AD Configuration
VITE_CLIENT_ID=your-azure-app-client-id
VITE_TENANT_ID=your-azure-tenant-id
VITE_REDIRECT_URI=http://localhost:5173

# SharePoint Configuration
VITE_SHAREPOINT_SITE_URL=https://yourorg.sharepoint.com/sites/YourSite
VITE_EXCEL_FILE_NAME=Book.xlsx
VITE_EXCEL_TABLE_NAME=RepairTable
VITE_SHOPS_FILE_NAME=Shops.xlsx
VITE_SHOPS_TABLE_NAME=ShopsTable

# Storage Configuration
VITE_STORAGE_TYPE=sharepoint  # or "onedrive"
VITE_DRIVE_ID=your-drive-id (optional - auto-detected)

# Backend API
VITE_BACKEND_URL=http://localhost:3001

# AI Configuration (optional - can use backend proxy)
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxx
```

---

## Azure Configuration

### 1. Register Azure AD Application

**Azure Portal Steps:**
1. Navigate to **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name:** GenThrust RO Tracker
   - **Supported account types:** Single tenant
   - **Redirect URI:**
     - Type: Single-page application (SPA)
     - URI: `http://localhost:5173` (dev) or `https://your-domain.com` (prod)
4. Click **Register**

### 2. Configure API Permissions

**Required Permissions:**
- `User.Read` (Delegated)
- `Files.ReadWrite.All` (Delegated)
- `Sites.Read.All` (Delegated)
- `Mail.Send` (Delegated)
- `Tasks.ReadWrite` (Delegated)
- `Calendars.ReadWrite` (Delegated)

**Grant Admin Consent** (if required by organization)

### 3. Configure Authentication

**Authentication Settings:**
- **Platform:** Single-page application
- **Redirect URIs:** Add all deployment URLs
- **Logout URL:** (optional)
- **Implicit grant:** ❌ (not needed for MSAL 2.0+)

### 4. Note Your Credentials

Copy these values to `.env.local`:
- **Application (client) ID** → `VITE_CLIENT_ID`
- **Directory (tenant) ID** → `VITE_TENANT_ID`

---

## SharePoint Setup

### 1. Create SharePoint Site (if needed)

1. Navigate to SharePoint admin center
2. Create new site (Team site or Communication site)
3. Note the site URL

### 2. Prepare Excel Files

**Book.xlsx (Repair Orders):**
- Create Excel file with 4 sheets:
  - **RepairTable** (active ROs) - **Must be Excel Table**
  - **Paid** (completed, paid) - **Must be Excel Table**
  - **NET** (received, awaiting payment) - **Must be Excel Table**
  - **Returns** (BER, RAI, cancelled) - **Must be Excel Table**

**Required Columns for RepairTable:**
```
RO Number | Date Made | Shop Name | Part Number | Serial Number |
Part Description | Required Work | Date Dropped Off | Estimated Cost |
Final Cost | Terms | Shop Reference Number | Estimated Delivery Date |
Current Status | Current Status Date | GenThrust Status | Shop Status |
Tracking Number | Notes | Last Date Updated | Next Date to Update | Checked
```

**Shops.xlsx (Shop Directory):**
- Create Excel file with 1 sheet:
  - **ShopsTable** - **Must be Excel Table**

**Required Columns for ShopsTable:**
```
Customer Number | Business Name | Address Line 1 | Address Line 2 |
Address Line 3 | Address Line 4 | City | State | Zip | Country |
Phone | Toll Free | Fax | Email | Website | Contact | Payment Terms |
ILS Code | Last Sale Date | YTD Sales
```

### 3. Upload to SharePoint

1. Upload both Excel files to SharePoint site
2. Note exact file names (case-sensitive)
3. Ensure files are in site root or document library

### 4. Create Attachment Folders

**Option A: SharePoint (Recommended)**
- Create folder: `RO Attachments` in site document library
- Subfolders created automatically per RO

**Option B: OneDrive**
- Set `VITE_STORAGE_TYPE=onedrive`
- Folder: `RO Attachments` in user's OneDrive root

### 5. Get SharePoint Site Details

**Method 1: Using Graph Explorer**
```
GET https://graph.microsoft.com/v1.0/sites/root:/sites/YourSiteName
```

**Method 2: Using Browser Console**
Copy to `get-site-id.html`:
```html
<!DOCTYPE html>
<html>
<body>
<script>
  const siteUrl = 'https://yourorg.sharepoint.com/sites/YourSite';
  const sitePath = new URL(siteUrl).pathname;
  console.log('Site path:', sitePath);
  console.log('Use this in Graph API: /sites/root:' + sitePath);
</script>
</body>
</html>
```

---

## Backend Deployment

### Development
```bash
cd backend
npm start
```

### Production Options

**Option 1: Azure App Service**
```bash
# 1. Create App Service
az webapp create \
  --resource-group genthrust-rg \
  --plan genthrust-plan \
  --name genthrust-backend \
  --runtime "NODE:18-lts"

# 2. Configure environment variables
az webapp config appsettings set \
  --resource-group genthrust-rg \
  --name genthrust-backend \
  --settings \
    DB_HOST=your-mysql-host \
    DB_USER=your-mysql-user \
    DB_PASSWORD=your-mysql-password \
    DB_NAME=genthrust_inventory \
    ANTHROPIC_API_KEY=sk-ant-xxxxx

# 3. Deploy
cd backend
zip -r deploy.zip .
az webapp deployment source config-zip \
  --resource-group genthrust-rg \
  --name genthrust-backend \
  --src deploy.zip
```

**Option 2: Docker Container**
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t genthrust-backend .
docker run -p 3001:3001 --env-file .env genthrust-backend
```

**Option 3: PM2 (VPS/Dedicated Server)**
```bash
# Install PM2
npm install -g pm2

# Start backend
cd backend
pm2 start npm --name "genthrust-backend" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

---

## Frontend Deployment

### Production Build
```bash
cd repair-dashboard
npm run build
# Output: /dist folder
```

### Deployment Options

**Option 1: Azure Static Web Apps (Recommended)**
```bash
# 1. Create Static Web App
az staticwebapp create \
  --name genthrust-tracker \
  --resource-group genthrust-rg \
  --source https://github.com/Cal9233/Genthrust_Repairs \
  --branch main \
  --app-location "/repair-dashboard" \
  --output-location "dist"

# 2. Configure environment variables in Azure Portal
# Settings → Configuration → Application settings
```

**Option 2: Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd repair-dashboard
vercel --prod

# Configure environment variables in Vercel dashboard
```

**Option 3: Netlify**
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist

# Configure environment variables in Netlify dashboard
```

**Option 4: Traditional Web Server (Nginx)**
```nginx
# /etc/nginx/sites-available/genthrust
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/genthrust/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Mobile (iPhone) Deployment

### Prerequisites
- Xcode 14+
- Apple Developer Account
- Capacitor CLI

### Setup Capacitor

```bash
cd repair-dashboard

# Install Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios

# Initialize Capacitor
npx cap init

# Build web assets
npm run build

# Add iOS platform
npx cap add ios

# Copy web assets to iOS
npx cap copy ios

# Open in Xcode
npx cap open ios
```

### Configure iOS App

**File:** `capacitor.config.ts`
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.genthrust.rotracker',
  appName: 'GenThrust RO Tracker',
  webDir: 'dist',
  server: {
    // For development
    url: 'http://localhost:5173',
    cleartext: true
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
```

### Xcode Configuration

1. **Open project:** `ios/App/App.xcworkspace`
2. **Set Bundle Identifier:** `net.genthrust.rotracker`
3. **Set Team:** Your Apple Developer team
4. **Configure capabilities:**
   - ✅ Background Modes (if needed)
   - ✅ Push Notifications (if needed)
5. **Update Info.plist:**
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
     <key>NSAllowsArbitraryLoads</key>
     <true/>
   </dict>
   ```

### Build & Deploy

**Development (Simulator):**
```bash
# Run on simulator
npx cap run ios
```

**Production (TestFlight):**
1. Xcode → Product → Archive
2. Upload to App Store Connect
3. Submit to TestFlight
4. Invite testers via email

**Production (Ad Hoc):**
1. Xcode → Product → Archive
2. Distribute App → Ad Hoc
3. Export IPA
4. Distribute via enterprise MDM or direct install

---

## Testing & Verification

### Backend Health Check
```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Database Connection
```bash
curl http://localhost:3001/api/inventory/stats
# Expected: {"totalItems":..., "totalQty":...}
```

### Frontend Authentication
1. Navigate to http://localhost:5173
2. Click "Sign in with Microsoft"
3. Authenticate with Azure AD
4. Should redirect to dashboard

### API Integration Test
```bash
# Search inventory
curl "http://localhost:3001/api/inventory/search?partNumber=123-456"

# Low stock check
curl "http://localhost:3001/api/inventory/low-stock?threshold=5"
```

### SharePoint Connection Test
1. Open browser console
2. Login to app
3. Navigate to "Repairs" tab
4. Check console for errors
5. Verify RO data loads

---

## Troubleshooting

### Common Issues

**1. CORS Errors**
```
Access to fetch at 'http://localhost:3001/api/...' from origin
'http://localhost:5173' has been blocked by CORS policy
```
**Fix:** Check `backend/.env` has `CORS_ORIGIN=http://localhost:5173`

**2. Excel File Not Found**
```
Error: File 'Book.xlsx' not found in SharePoint
```
**Fix:**
- Verify file name matches exactly (case-sensitive)
- Check file is in site root or document library
- Verify site URL is correct

**3. MySQL Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Fix:**
- Start MySQL server
- Check credentials in `backend/.env`
- Verify database `genthrust_inventory` exists

**4. Azure AD Login Popup Blocked**
```
MSAL error: popup_window_error
```
**Fix:**
- Allow popups from your domain
- Or use redirect flow (set in MSAL config)

**5. Token Expired (401 Unauthorized)**
```
Error: Token expired
```
**Fix:** Automatic - MSAL refreshes tokens automatically. If persists:
- Clear browser cache
- Sign out and sign in again

---

## Production Checklist

### Before Deploying

- [ ] All environment variables set in production
- [ ] Azure AD app configured with production redirect URIs
- [ ] SharePoint files uploaded and configured
- [ ] MySQL database populated with inventory
- [ ] API keys secured (not in client code)
- [ ] .gitignore includes `.env`, `.env.local`
- [ ] HTTPS enabled (required for MSAL)
- [ ] CORS configured for production domain
- [ ] Error tracking configured (Application Insights)
- [ ] Backup strategy implemented

### After Deploying

- [ ] Test authentication flow
- [ ] Test Excel read/write operations
- [ ] Test inventory search
- [ ] Test AI assistant
- [ ] Test file attachments
- [ ] Test email sending
- [ ] Test reminder creation (To Do, Calendar)
- [ ] Verify error handling
- [ ] Check performance metrics
- [ ] Monitor logs for errors

---

## Support & Resources

**Documentation:**
- See `.claude/ARCHITECTURE.md` for system architecture
- See `.claude/FLOWS.md` for user workflows
- See `backend/README.md` for API reference

**Azure Resources:**
- [Azure AD App Registration](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
- [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)

**Deployment Platforms:**
- [Azure Static Web Apps](https://azure.microsoft.com/en-us/services/app-service/static/)
- [Vercel](https://vercel.com)
- [Netlify](https://www.netlify.com)

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
