# Attachment Management - Quick Start

## ✅ What's Been Built

Your Repair Order attachment management system is now **fully integrated** and ready to use!

### Features Live Now:
1. **Drag-and-drop file upload** in RO Detail dialog
2. **Automatic folder organization** (each RO gets its own folder in OneDrive)
3. **File metadata tracking** (who uploaded, when, file sizes)
4. **Download & delete capabilities**
5. **Preview in browser**
6. **Loading states and error handling**

## 🚀 How to Use

### 1. Add API Permissions (One-Time Setup)

Go to [Azure Portal](https://portal.azure.com/) and add these permissions to your app:

**Required Permissions:**
- ✅ `Files.ReadWrite` - Read and write user files
- ✅ `Files.ReadWrite.All` - Read and write all files user can access

**How to add:**
1. Azure AD → App registrations → Your app
2. API permissions → Add permission → Microsoft Graph → Delegated
3. Search for "Files" and add both permissions
4. Click "Grant admin consent"

### 2. Start Using Attachments

1. **Open any Repair Order** detail dialog
2. **Scroll to "Attachments" section** (above Status History)
3. **Upload files:**
   - Drag and drop files onto the upload area, OR
   - Click the upload area to browse files
4. **Manage files:**
   - Click download icon to save file
   - Click browser icon to open in OneDrive
   - Click delete icon to remove file

### 3. Where Files Are Stored

Files are automatically organized in your OneDrive:
```
OneDrive/
└── RepairOrders/
    ├── RO-001/
    │   ├── quote.pdf
    │   └── damage-photo.jpg
    ├── RO-002/
    │   └── inspection-report.pdf
    └── RO-003/
        └── customer-email.msg
```

You can browse these folders directly in [OneDrive](https://onedrive.live.com/)!

## 🔧 Configuration

**Default:** Uses OneDrive (already configured)

**To switch to SharePoint:** See `SHAREPOINT_SETUP.md` for detailed instructions

## 📁 Files Added

**New Files:**
- `/src/types/index.ts` - Added `Attachment` and `AttachmentUploadProgress` interfaces
- `/src/config/sharepoint.ts` - Configuration for storage location
- `/src/services/sharepoint.ts` - Service layer for file operations
- `/src/hooks/useAttachments.ts` - React Query hooks
- `/src/components/AttachmentManager.tsx` - UI component
- `/src/lib/utils.ts` - Added `formatBytes()` utility

**Modified Files:**
- `/src/components/RODetailDialog.tsx` - Added AttachmentManager integration
- `/src/App.tsx` - Added sharePointService initialization

## 🎯 What Happens When You Upload

1. **File is selected** → Upload starts immediately
2. **Folder created** → `/RepairOrders/RO-{number}/` (if it doesn't exist)
3. **File uploaded** → To OneDrive using Microsoft Graph API
4. **Metadata captured** → Who uploaded, when, file size, etc.
5. **UI updates** → File appears in the list automatically

## 🔐 Security

- All operations use Microsoft Graph API with OAuth 2.0
- Files stored in **your** Microsoft 365 tenant
- Access controlled by Azure AD authentication
- Automatic version history (by Microsoft)
- Deleted files go to recycle bin (can be recovered)

## ⚡ Performance

- Small files (<4MB): Direct upload
- Large files (>4MB): Automatic chunked upload
- Maximum file size: 250GB (Microsoft limit)

## 🐛 Troubleshooting

### "Failed to upload"
- **Check permissions** in Azure Portal
- **Verify you're signed in** with Azure AD
- **Check file size** (must be <250GB)

### "Graph client not initialized"
- **Refresh the page** - MSAL may not be ready
- **Check console** for auth errors

### Files not showing
- **Wait a moment** - fetching from OneDrive
- **Check OneDrive** directly to verify files exist
- **Refresh** the RO dialog

## 📊 Example Use Cases

**Scenario 1: Customer sends photos of damage**
1. Receive email with 5 photos
2. Open RO in tracker
3. Drag all 5 photos into attachments
4. Done! Photos stored with RO forever

**Scenario 2: Need to share quote with customer**
1. Find quote PDF in attachments
2. Click browser icon
3. OneDrive opens → Click "Share"
4. Send link to customer

**Scenario 3: Part is complete, archive everything**
- All files already organized by RO number
- Easy to find months/years later
- Version history automatically maintained

## 🔮 Future Enhancements (Infrastructure Ready)

The code is structured to easily add:

1. **Email attachment auto-save**
   - Monitor Outlook inbox
   - Auto-extract attachments from RO emails
   - Save directly to correct RO folder

2. **Bulk operations**
   - Upload entire folders
   - Download all attachments as ZIP

3. **Advanced search**
   - Search within file contents
   - Filter by file type, date, uploader

4. **File sharing**
   - Generate shareable links
   - Set expiration dates

## 💡 Tips

- **Consistent naming:** Use descriptive file names (e.g., "damage-left-wing.jpg" not "IMG_1234.jpg")
- **Delete test files:** Keep folders clean
- **Use folders in OneDrive:** You can create subfolders for organization
- **Version control:** Microsoft automatically saves versions when you re-upload same filename

## 📞 Need Help?

Check the detailed setup guide: `SHAREPOINT_SETUP.md`

---

**Built with:** React, TypeScript, Microsoft Graph API, OneDrive
**Status:** ✅ Production Ready
