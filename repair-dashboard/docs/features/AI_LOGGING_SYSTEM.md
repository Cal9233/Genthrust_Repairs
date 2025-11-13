# AI Agent Logging System

This document explains the comprehensive logging system that tracks all AI agent interactions and stores them in SharePoint/OneDrive for audit purposes.

## Overview

Every time a user interacts with the AI assistant, the conversation is automatically logged to a text file in OneDrive/SharePoint. Logs are organized by date, making it easy to track what changes were made and when.

## Features

### Automatic Logging
- ✅ All AI agent conversations are logged automatically
- ✅ Both successful and failed interactions are recorded
- ✅ Logs include timestamps, user names, prompts, and responses
- ✅ Errors are captured with full error messages

### Organized Storage
- 📁 Logs stored in `/AI_Logs` folder in OneDrive/SharePoint
- 📅 One file per day: `logs_2025-01-12.txt`
- 📝 Text format for easy reading and sharing
- 🔄 Automatic folder creation on first use

### Log Viewer UI
- 👁️ Browse all log files by date
- 📖 View log contents in a formatted display
- 💾 Download logs for external analysis
- 🗑️ Delete old logs when no longer needed
- 🔄 Refresh to see latest logs

## How It Works

### 1. Logging Service (`loggingService.ts`)

The logging service handles all file operations:

```typescript
// Log an AI interaction
await loggingService.logInteraction({
  timestamp: new Date(),
  user: 'John Doe',
  userMessage: 'Update RO 12345 to PAID',
  aiResponse: '✓ Done! RO 12345 → Status changed to PAID',
  success: true
});
```

**Methods:**
- `logInteraction()` - Log a conversation
- `getLogFiles()` - List all log files
- `getLogFileContent()` - Read a specific log file
- `deleteLogFile()` - Delete a log file

### 2. AI Agent Integration

Every AI conversation is automatically logged:

**Success Case:**
```typescript
const response = await anthropicAgent.processCommand(userMessage, context);

// Log successful interaction
loggingService.logInteraction({
  timestamp: new Date(),
  user: currentUser,
  userMessage: userMessage,
  aiResponse: getMessageText(response.content),
  success: true
});
```

**Error Case:**
```typescript
catch (error) {
  loggingService.logInteraction({
    timestamp: new Date(),
    user: currentUser,
    userMessage: userMessage,
    aiResponse: errorResponse,
    success: false,
    error: errorMessage
  });
}
```

### 3. Log File Format

Logs are stored in a human-readable format:

```
================================================================================
[01/12/2025, 03:45:23 PM] - ✓ SUCCESS
User: John Doe
================================================================================

USER REQUEST:
Update RO 38530, 38526, 38566, 38551 to RAI

AI RESPONSE:
✓ Perfect! I've successfully updated all 4 ROs to "RAI" (Return As Is) status:

- **RO38530** → RAI
- **RO38526** → RAI
- **RO38566** → RAI
- **RO38551** → RAI

All updates completed successfully.

================================================================================


================================================================================
[01/12/2025, 04:12:45 PM] - ✗ FAILED
User: Jane Smith
================================================================================

USER REQUEST:
Delete RO 99999

AI RESPONSE:
I encountered an error: RO 99999 not found. Please try again or rephrase your command.

ERROR:
RO 99999 not found

================================================================================
```

### 4. Log Viewer Component

Access logs through the main navigation:

**Button Location:**
- Top navigation bar
- Icon: 📄 FileText
- Label: "Logs" (hidden on mobile)
- Click to open Logs Dialog

**Dialog Features:**
- **Left Panel**: List of log files sorted by date (newest first)
- **Right Panel**: Selected log content with formatted display
- **Actions**: Download, Delete, Refresh

## File Structure

```
📁 OneDrive/SharePoint
└── 📁 AI_Logs/
    ├── 📄 logs_2025-01-12.txt
    ├── 📄 logs_2025-01-11.txt
    ├── 📄 logs_2025-01-10.txt
    └── 📄 ...
```

## Use Cases

### 1. Audit Trail
Track all data modifications made through the AI agent:
- Who made changes
- What changes were made
- When changes occurred
- Whether changes succeeded or failed

### 2. Troubleshooting
When something goes wrong:
- Review error messages
- See exact user prompts
- Identify patterns in failures
- Understand context of issues

### 3. Compliance
Maintain records for:
- Regulatory compliance
- Internal audits
- Data integrity verification
- User accountability

### 4. Training
Improve AI agent performance:
- Review successful interactions
- Identify common user patterns
- Find edge cases
- Improve system prompts

## Security & Privacy

### Permissions
- Logs stored in user's OneDrive/SharePoint
- Same Microsoft authentication as rest of app
- User can only access their own organization's logs

### Data Retention
- Logs persist until manually deleted
- No automatic cleanup (you control retention)
- Can download before deleting for archival

### What's Logged
- ✅ User name (from Microsoft account)
- ✅ Timestamp
- ✅ User's command/question
- ✅ AI's response
- ✅ Success/failure status
- ✅ Error messages (if failed)
- ❌ Sensitive data is NOT sanitized (full conversation logged)

**Note:** Do not ask the AI to process sensitive information like passwords, SSNs, credit cards, etc. as they will be logged.

## Implementation Details

### Services Integration

All services are initialized in `App.tsx`:

```typescript
useEffect(() => {
  if (instance) {
    excelService.setMsalInstance(instance);
    shopService.setMsalInstance(instance);
    reminderService.setMsalInstance(instance);
    sharePointService.setMsalInstance(instance);
    loggingService.setMsalInstance(instance); // ← Logging service
    console.log("[App] MSAL instance set for services");
  }
}, [instance]);
```

### Microsoft Graph API Endpoints

**Create/Write Log File:**
```
PUT /me/drive/root:/AI_Logs/logs_2025-01-12.txt:/content
```

**List Log Files:**
```
GET /me/drive/root:/AI_Logs:/children
```

**Read Log File:**
```
GET /me/drive/root:/AI_Logs/logs_2025-01-12.txt:/content
```

**Delete Log File:**
```
DELETE /me/drive/root:/AI_Logs/logs_2025-01-12.txt
```

### Error Handling

Logging failures are non-blocking:
```typescript
try {
  await loggingService.logInteraction(entry);
} catch (error) {
  console.error('[LoggingService] Failed to log:', error);
  // Don't throw - logging failures shouldn't break the app
}
```

The app continues to function even if logging fails.

## Files Modified/Created

### New Files
1. `src/lib/loggingService.ts` - Core logging service
2. `src/components/LogsDialog.tsx` - Log viewer UI component
3. `AI_LOGGING_SYSTEM.md` - This documentation

### Modified Files
1. `src/components/AIAgentDialog.tsx` - Added logging calls
2. `src/App.tsx` - Added Logs button and dialog, initialized logging service

## Usage Examples

### Viewing Logs

1. Click the "Logs" button in the top navigation
2. Select a date from the left panel
3. View the formatted log content on the right
4. Download or delete as needed

### Searching for Specific Changes

1. Open the log file for the relevant date
2. Use browser search (Ctrl+F / Cmd+F) to find:
   - Specific RO numbers
   - User names
   - Keywords in prompts/responses
3. Review the full conversation context

### Downloading for Analysis

1. Select the log file
2. Click "Download" button
3. Log saved as `.txt` file
4. Open in any text editor or import to Excel/database

## Future Enhancements

Potential improvements:
- [ ] Search across all logs
- [ ] Filter by user
- [ ] Filter by success/failure
- [ ] Export date range
- [ ] Automatic archival to long-term storage
- [ ] Log analytics dashboard
- [ ] Automatic sensitive data redaction

## Troubleshooting

### Logs Not Appearing

**Problem:** No logs showing in the viewer
**Solutions:**
1. Check if AI_Logs folder exists in OneDrive
2. Verify MSAL instance is initialized
3. Check browser console for errors
4. Refresh the logs list

### Cannot Access Logs

**Problem:** Error when opening logs
**Solutions:**
1. Ensure you're authenticated
2. Check Microsoft Graph API permissions
3. Verify OneDrive access
4. Try logging out and back in

### Logs Missing Data

**Problem:** Log entries incomplete
**Solutions:**
1. Check if logging service was initialized
2. Verify error wasn't thrown during logging
3. Check file encoding (should be UTF-8)
4. Ensure network connectivity during log write

## Best Practices

1. **Regular Review**: Check logs periodically for errors
2. **Retention Policy**: Delete old logs after retention period
3. **Backup**: Download important logs before deleting
4. **Security**: Don't log sensitive information
5. **Monitoring**: Watch for unusual patterns or errors

## Build Status

✅ Build successful
- CSS: 64.37 kB (11.25 kB gzipped)
- JS: 921.09 kB (256.26 kB gzipped)
