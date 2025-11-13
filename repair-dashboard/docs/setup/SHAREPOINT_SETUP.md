# SharePoint Attachment Management Setup Guide

This guide will help you configure attachment management for Repair Orders using Microsoft Graph API and OneDrive/SharePoint.

## Features

- ✅ **Drag-and-drop file upload** - Simple, intuitive interface
- ✅ **Automatic folder organization** - Each RO gets its own folder
- ✅ **Complete version history** - Microsoft handles all versioning
- ✅ **Automatic metadata tracking** - Who uploaded, when, file sizes
- ✅ **Secure cloud storage** - Files stored in your Microsoft 365 account
- ✅ **Quick preview and download** - One-click access to files
- ✅ **Permission management** - Controlled by Azure AD

## Current Configuration

The system is configured to use **SharePoint** to store files alongside your Excel file at:
- **Site**: `https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite`
- **Location**: `/Shared Documents/RO_Attachments/{RO-Number}/`

## Quick Start (Using SharePoint)

### 1. Add Microsoft Graph Permissions

In your Azure AD App Registration, add these API permissions:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Select your app (Genthrust Repair Dashboard)
4. Click **API permissions** → **Add a permission**
5. Select **Microsoft Graph** → **Delegated permissions**
6. Add these permissions:
   - ✅ `Files.ReadWrite` - Read and write user files
   - ✅ `Files.ReadWrite.All` - Read and write all files user can access

7. Click **Grant admin consent** (requires admin)

### 2. Get Your SharePoint Site ID

**⚠️ IMPORTANT**: You need to get your Site ID before the attachment feature will work.

**Your SharePoint Site**: `https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite`

**Method 1 - Using Graph Explorer (Recommended):**
1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your Microsoft account
3. Run this exact query:
   ```
   GET https://graph.microsoft.com/v1.0/sites/genthrustxvii.sharepoint.com:/sites/PartsQuotationsWebsite
   ```
4. Copy the `id` field from the response (format: `genthrustxvii.sharepoint.com,abc-123,def-456`)
5. Update `src/config/sharepoint.ts` line 34 with this ID

**Method 2 - Using the Helper Page:**
1. Open `get-site-id.html` in your browser
2. Click "Get Site ID" button
3. Sign in when prompted
4. Copy the Site ID shown
5. Update `src/config/sharepoint.ts` line 34 with this ID

**Method 3 - Using PowerShell:**
```powershell
Connect-MgGraph -Scopes "Sites.Read.All"
Get-MgSite -Search "PartsQuotationsWebsite"
```

### 3. Update Configuration with Site ID

Edit `src/config/sharepoint.ts` line 34:

```typescript
// BEFORE:
siteId: 'PASTE_YOUR_SITE_ID_HERE',

// AFTER (use the ID you got from step 2):
siteId: 'genthrustxvii.sharepoint.com,abc-123-def,456-ghi-789',
```

### 4. Test the Integration

1. Open a Repair Order detail dialog
2. Scroll to the "Attachments" section
3. Drag and drop a file or click to browse
4. The file will be uploaded to SharePoint at: `/Shared Documents/RO_Attachments/RO-{number}/filename.ext`

### 5. View Files in SharePoint

- Open [your SharePoint site](https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite)
- Navigate to **Shared Documents** → **RO_Attachments**
- You'll see folders for each RO number

## File Size Limits

- **Small files (<4MB)**: Simple upload
- **Large files (>4MB)**: Automatic chunked upload
- **Maximum file size**: 250GB (Microsoft OneDrive/SharePoint limit)

## Folder Structure

Files are organized in your SharePoint site:

```
SharePoint/PartsQuotationsWebsite/Shared Documents/
├── Book.xlsx  (Your existing Excel file)
├── RO_Attachments/  (Created automatically)
    ├── RO-001/
    │   ├── quote.pdf
    │   ├── damage-photo.jpg
    │   └── final-invoice.pdf
    ├── RO-002/
    │   └── inspection-report.pdf
    └── RO-003/
        └── customer-email.msg
```

**Note**: The `RO_Attachments` folder and individual RO folders are created automatically on first upload.

## Troubleshooting

### "SharePoint Site ID not configured"
- **Cause**: You haven't added your Site ID to the configuration yet
- **Solution**: Follow Step 2 above to get your Site ID and update `src/config/sharepoint.ts` line 34

### "Graph client not initialized"
- Make sure you're signed in with Azure AD
- Check that the app is properly configured in `src/lib/msalConfig.ts`
- Try refreshing the page

### "Failed to upload"
- Verify API permissions are granted in Azure Portal (Step 1)
- Check file size (must be <250GB)
- Ensure you have write access to the SharePoint site
- Check browser console for detailed error message

### "404 - Folder not found" or "itemNotFound"
- The folder is created automatically on first upload
- Verify the site ID is correct (should start with `genthrustxvii.sharepoint.com,`)
- Check that the base folder path `/Shared Documents/RO_Attachments` is correct
- Ensure you have access to the SharePoint site

### "Insufficient privileges" or "accessDenied"
- Admin must grant consent to API permissions in Azure Portal
- Verify you have permissions to create files in the SharePoint site
- Check that you're signed in with the correct Microsoft account

## Security Notes

- All file operations use Microsoft Graph API with OAuth 2.0
- Files are stored in your Microsoft 365 tenant
- Access is controlled by Azure AD authentication
- File version history is automatically maintained by Microsoft
- Deleted files go to recycle bin (can be recovered)

## Future Enhancements (Ready to Add)

The infrastructure is built to support these features:

1. **Email Attachment Auto-Save**
   - Monitor Outlook inbox for RO-related emails
   - Automatically extract and save attachments
   - Link emails to RO records

2. **Bulk Upload**
   - Upload entire folders
   - Progress tracking for multiple files

3. **File Sharing**
   - Generate shareable links
   - Set expiration dates
   - Control permissions

4. **Advanced Search**
   - Search within file contents
   - Filter by file type, date, uploader

## Support

For issues or questions:
- Check the console for detailed error messages
- Verify Azure AD app permissions
- Test Graph API access at https://developer.microsoft.com/en-us/graph/graph-explorer

---

**Configuration File**: `src/config/sharepoint.ts`
**Service Layer**: `src/services/sharepoint.ts`
**React Hooks**: `src/hooks/useAttachments.ts`
**UI Component**: `src/components/AttachmentManager.tsx`
