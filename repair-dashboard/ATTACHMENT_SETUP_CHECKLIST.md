# 📋 Attachment Feature Setup Checklist

## Current Status: ⚠️ Needs Configuration

The attachment management system is **fully built and ready**, but needs 2 quick setup steps before you can use it.

---

## ✅ Step 1: Get Your SharePoint Site ID

Choose **ONE** method:

### Option A: Graph Explorer (Fastest - 2 minutes)
1. Open [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your Microsoft account
3. Paste this query and click "Run query":
   ```
   https://graph.microsoft.com/v1.0/sites/genthrustxvii.sharepoint.com:/sites/PartsQuotationsWebsite
   ```
4. Copy the `id` value (looks like: `genthrustxvii.sharepoint.com,abc-123,def-456`)

### Option B: Helper HTML Page
1. Open `get-site-id.html` in your browser
2. Click "Get Site ID" button
3. Sign in and copy the ID shown

### Option C: PowerShell
```powershell
Connect-MgGraph -Scopes "Sites.Read.All"
Get-MgSite -Search "PartsQuotationsWebsite"
```

---

## ✅ Step 2: Update Configuration

1. Open `repair-dashboard/src/config/sharepoint.ts`
2. Find line 34 (currently says `PASTE_YOUR_SITE_ID_HERE`)
3. Replace with the Site ID from Step 1:
   ```typescript
   siteId: 'genthrustxvii.sharepoint.com,abc-123-def,456-ghi-789', // Your actual ID
   ```
4. Save the file

---

## ✅ Step 3: Add Azure Permissions (One-Time)

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate: **Azure AD** → **App registrations** → **Your app**
3. Click **API permissions** → **Add a permission**
4. Select **Microsoft Graph** → **Delegated permissions**
5. Search and add:
   - `Files.ReadWrite`
   - `Files.ReadWrite.All`
6. Click **"Grant admin consent"** (blue button at top)

---

## 🎉 Step 4: Test It!

1. Run `npm run dev` in the `repair-dashboard` folder
2. Open the app and sign in
3. Open any Repair Order
4. Scroll to "Attachments" section
5. Drag and drop a file to test!

---

## 📍 Where Files Are Stored

Files will be saved to:
```
https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite
  └── Shared Documents/
      ├── Book.xlsx  (your existing Excel file)
      └── RO_Attachments/  (NEW - created automatically)
          ├── RO-001/
          │   └── your-files.pdf
          ├── RO-002/
          └── RO-003/
```

**Same location as your Excel file** - everything in one place! ✅

---

## 🐛 If Something Goes Wrong

**Error: "SharePoint Site ID not configured"**
→ You missed Step 2. Update the config file.

**Error: "Insufficient privileges"**
→ You need to complete Step 3 (Azure permissions).

**Error: "404 - not found"**
→ Site ID might be wrong. Double-check Step 1.

**Files not uploading?**
→ Check browser console (F12) for detailed error message.

---

## ℹ️ More Info

- **Detailed Guide**: See `SHAREPOINT_SETUP.md`
- **User Documentation**: See `ATTACHMENTS_README.md`

---

## 🚀 What You'll Have After Setup

- ✅ Drag-and-drop file upload for ROs
- ✅ Automatic folder organization
- ✅ Track who uploaded what and when
- ✅ Download and preview attachments
- ✅ Delete files when needed
- ✅ All files backed up in Microsoft cloud
- ✅ Version history (by Microsoft)
- ✅ Search and organize in SharePoint

**Total setup time: ~5 minutes** ⏱️
