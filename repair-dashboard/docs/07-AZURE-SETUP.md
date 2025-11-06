# PHASE 7: AZURE AD SETUP (20 minutes)

This phase sets up authentication through Azure Active Directory.

---

## Prerequisites

- Access to Azure Portal
- Azure AD admin permissions (or ask your IT admin)
- Microsoft 365 account

---

## Step-by-Step Setup

### 1. Go to Azure Portal

Navigate to: https://portal.azure.com

---

### 2. Navigate to Azure Active Directory

1. Click on **Azure Active Directory** in the left sidebar
2. Or search for "Azure Active Directory" in the top search bar

---

### 3. Create App Registration

1. Click **App registrations** in the left menu
2. Click **+ New registration**

---

### 4. Configure Registration

Fill in the following:

**Name:**
```
GenThrust RO Tracker
```

**Supported account types:**
- Select: **Accounts in this organizational directory only (Single tenant)**

**Redirect URI:**
- Platform type: **Single-page application (SPA)**
- URI: `http://localhost:5173`

Click **Register**

---

### 5. Copy Credentials

After registration, you'll see the app overview page.

**Copy these values:**

1. **Application (client) ID**
   - Example: `12345678-1234-1234-1234-123456789abc`
   - This goes in `.env.local` as `VITE_CLIENT_ID`

2. **Directory (tenant) ID**
   - Example: `87654321-4321-4321-4321-cba987654321`
   - This goes in `.env.local` as `VITE_TENANT_ID`

---

### 6. Add API Permissions

1. Click **API permissions** in the left menu
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add the following permissions:

   **Required permissions:**
   - `User.Read` - Read user profile
   - `Files.Read.All` - Read all files user can access
   - `Files.ReadWrite.All` - Read and write all files user can access
   - `Sites.Read.All` - Read items in all site collections

6. Click **Add permissions**

---

### 7. Grant Admin Consent

**Important:** These permissions require admin consent.

1. Click **✓ Grant admin consent for [Your Organization]**
2. Click **Yes** to confirm
3. Wait for the green checkmarks to appear

If you don't have admin permissions, ask your IT administrator to grant consent.

---

### 8. Update Environment Variables

Update your `.env.local` file:

```env
# Azure AD Configuration
VITE_CLIENT_ID=12345678-1234-1234-1234-123456789abc
VITE_TENANT_ID=87654321-4321-4321-4321-cba987654321

# SharePoint Configuration (update these too)
VITE_SHAREPOINT_SITE_URL=https://yourcompany.sharepoint.com/sites/yoursite
VITE_EXCEL_FILE_NAME=GEN_REPAIRS_LIST__RO_S_OUTSIDE__.xlsx
VITE_EXCEL_TABLE_NAME=Table1
```

---

### 9. Test Authentication

```bash
# Start the dev server
npm run dev

# Open browser to http://localhost:5173
# Click "Sign in with Microsoft"
# You should see the Microsoft login popup
# After login, you should see the dashboard
```

---

## SharePoint Configuration

### Finding Your SharePoint Site URL

1. Go to your SharePoint site in the browser
2. Copy the URL from the address bar
3. It should look like: `https://yourcompany.sharepoint.com/sites/yoursite`
4. Use this as `VITE_SHAREPOINT_SITE_URL`

### Finding Your Excel File Name

1. Open the Excel file in SharePoint
2. The file name is in the browser tab and title
3. Example: `GEN_REPAIRS_LIST__RO_S_OUTSIDE__.xlsx`
4. Use this as `VITE_EXCEL_FILE_NAME`

### Finding Your Table Name

1. Open the Excel file
2. Click on any cell in your data table
3. Go to **Table Design** tab (it appears when table is selected)
4. Look at **Table Name** field (usually in the top-left)
5. Default is usually `Table1`
6. Use this as `VITE_EXCEL_TABLE_NAME`

---

## Troubleshooting

### "AADSTS700016: Application not found"
- Double-check your Client ID
- Make sure you copied the full ID without extra spaces

### "AADSTS50011: The redirect URI does not match"
- Ensure redirect URI is exactly `http://localhost:5173`
- No trailing slash
- http not https for localhost

### "Insufficient privileges to complete the operation"
- Admin consent not granted
- Ask IT admin to grant permissions

### "File not found"
- Check Excel file name is exact (case-sensitive)
- Verify file is in SharePoint (not OneDrive)
- Ensure table exists in Excel

---

## Production Setup (When Deploying)

When you deploy to production (Vercel/Azure), you need to:

1. Go back to Azure AD App Registration
2. Go to **Authentication**
3. Under **Single-page application**, click **+ Add URI**
4. Add your production URL: `https://your-app.vercel.app`
5. Click **Save**

The app will work on both localhost and production.

---

## Security Notes

- Never commit `.env.local` to git (already in `.gitignore`)
- Client ID is not secret (safe to expose in frontend)
- Tenant ID is not secret
- Access tokens are managed by MSAL automatically
- Tokens are stored in session storage (cleared on browser close)

---

## Checkpoint

At this point you should have:

- ✅ Azure AD app registration created
- ✅ Client ID and Tenant ID copied
- ✅ API permissions added and consented
- ✅ Environment variables configured
- ✅ Authentication working in local dev

**Next:** [Phase 8: Deployment](08-DEPLOYMENT.md)
