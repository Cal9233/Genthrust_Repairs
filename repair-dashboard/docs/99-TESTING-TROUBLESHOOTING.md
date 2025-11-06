# TESTING & TROUBLESHOOTING

## Testing Checklist

Before considering the project complete, test all functionality:

### Authentication
- [ ] Can login with Microsoft account
- [ ] Login redirects back to app correctly
- [ ] User name displays in header
- [ ] Can logout successfully
- [ ] After logout, can't access protected routes

### Data Loading
- [ ] Dashboard shows correct stats
- [ ] Table loads all ROs from Excel
- [ ] Data matches Excel file
- [ ] Loading states appear briefly
- [ ] No infinite loading spinners

### Table Functionality
- [ ] Search works across all fields (RO#, shop, part, serial)
- [ ] Search results update in real-time
- [ ] Sorting works on RO# column
- [ ] Sorting works on Next Update column
- [ ] Row count shows filtered vs total correctly

### Detail View
- [ ] Can click "View" button on any row
- [ ] Dialog opens with full details
- [ ] All fields display correctly
- [ ] Dates are formatted properly
- [ ] Currency shows with $ and 2 decimals
- [ ] Can close dialog

### Status Updates
- [ ] Can open Update Status dialog
- [ ] Status dropdown shows all options
- [ ] Can add notes
- [ ] Submit button works
- [ ] Success toast appears
- [ ] Table refreshes with new status
- [ ] Excel file is actually updated

### Visual Indicators
- [ ] Overdue ROs are highlighted in red
- [ ] Status badges show correct colors
- [ ] Days overdue calculates correctly
- [ ] Icons appear in badges

### Responsive Design
- [ ] Mobile layout works (< 768px)
- [ ] Tablet layout works (768px - 1024px)
- [ ] Desktop layout works (> 1024px)
- [ ] Table scrolls horizontally on mobile
- [ ] Dialogs fit on small screens

### Auto-Refresh
- [ ] Data auto-refreshes every minute
- [ ] Manual refresh button works
- [ ] No console errors during refresh

---

## Common Issues & Solutions

### Authentication Issues

#### Issue: "AADSTS700016: Application not found"
**Solution:**
- Double-check your `VITE_CLIENT_ID` in `.env.local`
- Make sure you copied the full Application (client) ID from Azure
- No extra spaces or quotes

#### Issue: "AADSTS50011: The redirect URI does not match"
**Solution:**
- Verify redirect URI in Azure AD is exactly: `http://localhost:5173`
- No trailing slash
- Correct protocol (http for localhost, https for production)
- Make sure it's added under "Single-page application" platform

#### Issue: "Login popup appears but doesn't redirect back"
**Solution:**
- Check browser popup blocker settings
- Try a different browser
- Clear cookies and cache
- Verify `redirectUri` in `msalConfig.ts` is correct

#### Issue: "Insufficient privileges to complete the operation"
**Solution:**
- API permissions not granted
- Ask Azure AD admin to grant consent
- Check all 4 permissions are added and have green checkmarks

---

### Data Loading Issues

#### Issue: "File not found" error
**Solution:**
- Verify `VITE_EXCEL_FILE_NAME` is exactly correct (case-sensitive)
- Check file is in SharePoint, not OneDrive
- Ensure you have access to the file
- Try opening the file in SharePoint to confirm access

#### Issue: "Table not found" error
**Solution:**
- Open Excel file
- Click any cell in your data
- Go to Table Design tab
- Verify table name matches `VITE_EXCEL_TABLE_NAME`
- If no Table Design tab appears, your data isn't formatted as a table:
  - Select all data
  - Insert → Table
  - Check "My table has headers"
  - Note the table name

#### Issue: Data shows but dates are wrong
**Solution:**
- Excel date parsing issue
- Check `parseExcelDate()` function in `excelService.ts`
- Dates in Excel should be formatted as dates, not text
- If dates are in text format (like "10/15/2024"), you need to adjust parsing

#### Issue: Currency values are wrong or NaN
**Solution:**
- Check `parseCurrency()` function in `excelService.ts`
- Ensure Excel cells are formatted as currency or numbers
- If stored as text with $ symbol, parser should handle it
- Verify formula: `value.replace(/[$,]/g, "")`

#### Issue: "Graph API error: Unauthorized"
**Solution:**
- Token expired - try logout and login again
- Permissions not granted properly
- Check scopes in `msalConfig.ts`

---

### UI Issues

#### Issue: Components not rendering
**Solution:**
- Check console for errors
- Verify all imports are correct
- Check shadcn components are installed:
  ```bash
  npx shadcn-ui@latest add button
  npx shadcn-ui@latest add card
  # etc...
  ```
- Verify path aliases in `vite.config.ts`

#### Issue: Tailwind styles not working
**Solution:**
- Check `tailwind.config.js` content paths include your files
- Verify `@tailwind` directives in `index.css`
- Restart dev server after Tailwind config changes
- Clear browser cache

#### Issue: Icons not showing
**Solution:**
- Verify `lucide-react` is installed:
  ```bash
  npm install lucide-react
  ```
- Check import statements
- Icons are case-sensitive: `<AlertCircle />` not `<alertCircle />`

#### Issue: Toast notifications not appearing
**Solution:**
- Install sonner: `npm install sonner`
- Verify `<Toaster />` component is in `App.tsx`
- Check import: `import { Toaster } from "sonner"`
- Check console for errors

---

### Update Issues

#### Issue: Status updates but table doesn't refresh
**Solution:**
- Check `onSuccess` in `useUpdateROStatus` hook
- Verify `queryClient.invalidateQueries()` is called
- Manual refresh should work (refresh button in header)

#### Issue: Update fails silently
**Solution:**
- Check browser console for errors
- Verify row index is correct
- Check API permissions include `Files.ReadWrite.All`
- Test by manually updating Excel to confirm access

#### Issue: Update works but Excel shows old data
**Solution:**
- Excel file might be open and locked
- Close Excel and try again
- Check SharePoint file isn't checked out
- Wait a few seconds and check again (caching)

---

### Performance Issues

#### Issue: App is slow
**Solution:**
- Check how many ROs you have (10,000+ may be slow)
- Consider pagination for large datasets
- Check network tab for slow API calls
- Disable auto-refresh if not needed:
  ```typescript
  // In main.tsx, remove refetchInterval
  staleTime: 5 * 60 * 1000,
  // refetchInterval: 60 * 1000, // Comment this out
  ```

#### Issue: Search is laggy
**Solution:**
- Add debouncing to search:
  ```bash
  npm install use-debounce
  ```
  ```typescript
  import { useDebounce } from 'use-debounce';
  const [debouncedSearch] = useDebounce(search, 300);
  ```

---

### Deployment Issues

#### Issue: Works locally but not in production
**Solution:**
- Check environment variables are set in production
- Verify variables start with `VITE_` (required for Vite)
- Add production URL to Azure AD redirect URIs
- Check console for errors in production
- Verify build succeeds: `npm run build`

#### Issue: "Failed to fetch" errors in production
**Solution:**
- CORS issue - but shouldn't happen with Microsoft Graph
- Check API permissions are granted for production app
- Verify tokens are being acquired correctly
- Check browser console network tab for specific error

---

## Debug Mode

Add this to enable more detailed logs:

In `src/lib/excelService.ts`, add logging:

```typescript
private async callGraphAPI(endpoint: string, method = "GET", body?: any) {
  console.log('Graph API call:', method, endpoint); // Add this

  const token = await this.getAccessToken();
  // ... rest of code

  console.log('Graph API response:', response); // Add this
  return response.json();
}
```

---

## Getting Help

### Check Console
Always check browser console (F12) for errors.

### Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Try the failing action
4. Look for red/failed requests
5. Click on failed request to see details

### Check Microsoft Graph Explorer
Test your queries: https://developer.microsoft.com/en-us/graph/graph-explorer

### Useful Resources
- [Microsoft Graph API Docs](https://learn.microsoft.com/en-us/graph/api/overview)
- [MSAL.js Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [Vite Documentation](https://vitejs.dev)
- [React Query Docs](https://tanstack.com/query/latest)

---

## Known Limitations

### Excel Limitations
- 10,000 row limit for API reads
- Large files (>50MB) may be slow
- Formulas are not evaluated (shows values only)
- Some Excel features not accessible via API

### Graph API Limitations
- Rate limiting (throttling) on many requests
- Requires internet connection
- Session tokens expire after inactivity

### Browser Limitations
- Popup blockers may interfere with login
- Session storage cleared when browser closes
- Some browsers block 3rd party cookies

---

## Performance Benchmarks

Expected performance:
- **Login**: 2-3 seconds
- **Initial data load**: 3-5 seconds for 100 ROs
- **Search/filter**: Instant (<100ms)
- **Status update**: 2-4 seconds
- **Auto-refresh**: 2-3 seconds

If you're seeing significantly slower times, investigate:
1. Network speed
2. SharePoint server location
3. Excel file size
4. Number of ROs

---

## Next Steps

Once everything is working:

### Week 2+ Enhancements
- [ ] Export to PDF/Excel
- [ ] Bulk status updates
- [ ] Email shop directly from app
- [ ] Simple kanban board view
- [ ] Cost tracking chart
- [ ] Shop performance metrics
- [ ] Push notifications for overdue ROs
- [ ] Dark mode

### Quality of Life
- [ ] Keyboard shortcuts
- [ ] Bulk actions (select multiple ROs)
- [ ] Status change history
- [ ] Comments/activity log
- [ ] Mobile app (PWA)
- [ ] Offline mode

---

## Conclusion

You now have a fully functional RO tracking system that:
- ✅ Reads from your existing Excel file
- ✅ Shows real-time status and highlights overdue items
- ✅ Allows quick status updates
- ✅ Auto-refreshes data
- ✅ Works on mobile
- ✅ Costs $0/month to run

**Congratulations!**

---

**Back to:** [Project Overview](00-OVERVIEW.md)
