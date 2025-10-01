# Repair Station Dashboard - Development Instructions for Claude

## Project Context

This is a web dashboard for tracking aircraft parts sent to repair stations. The data is stored in an Excel file with 5 tables in SharePoint. The primary table is "RO Outside" but the dashboard should support switching between all 5 tables.

## Technology Stack

- **Frontend**: React 18+ with Vite
- **Authentication**: Microsoft MSAL (Azure AD)
- **Data Source**: Excel file in SharePoint via Microsoft Graph API
- **Styling**: Tailwind CSS
- **State Management**: React Query (@tanstack/react-query)
- **Icons**: lucide-react

## Excel Data Structure

The Excel file contains repair tracking data with these key columns:

- RO # (Repair Order Number)
- DATE MADE
- SHOP NAME (repair station name)
- PART # (part number)
- SERIAL # (serial number)
- PART DESCRIPTION
- REQ WORK (required work: OH, RP, TEST & SV, MOD, IP)
- DATE DROPPED OFF
- ESTIMATED COST
- FINAL COST
- TERMS (payment terms: COD, NET 30, PRE PAID, CC FORM, WIRE XFER)
- SHOP REF # (shop reference number)
- ESTIMATED DELIVERY DATE
- CURENT STATUS (WAITING QUOTE, APPROVED >>>>, WAITING FOR PARTS, IN PROGRESS, READY FOR PICKUP, COMPLETED, ON HOLD, CANCELLED)
- CURENT STATUS DATE
- GENTHRUST STATUS
- SHOP STATUS
- TRACKING NUMBER / PICKING UP
- NOTES
- LAST DATE UPDATED
- NEXT DATE TO UPDATE

## Project Structure

```
repair-dashboard/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx       # Main dashboard with metrics
│   │   ├── RepairTable.jsx     # Data table with search/filter/sort
│   │   ├── StatusBadge.jsx     # Status indicator component
│   │   └── FilterBar.jsx       # Search and filter controls (future)
│   ├── services/
│   │   ├── authConfig.js       # MSAL authentication config
│   │   └── excelService.js     # Excel/Graph API service layer
│   ├── App.jsx                 # Main app with authentication
│   ├── main.jsx                # Entry point
│   └── index.css               # Tailwind imports
├── .env                        # Environment variables
├── .env.example                # Environment template
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Environment Variables Required

```
VITE_CLIENT_ID=<Azure AD App Client ID>
VITE_TENANT_ID=<Azure AD Tenant ID>
VITE_SHAREPOINT_SITE_URL=<Full SharePoint site URL>
VITE_EXCEL_FILE_NAME=<Excel filename with extension>
```

## Azure AD Configuration

The app is registered in Azure AD with these settings:

- Redirect URI: http://localhost:5173 (SPA)
- Required API Permissions:
  - Microsoft Graph: User.Read (Delegated)
  - Microsoft Graph: Files.Read (Delegated)
  - Microsoft Graph: Files.ReadWrite (Delegated)

## Core Features to Implement

### 1. Authentication

- Use MSAL React for Azure AD authentication
- Sign-in page for unauthenticated users
- Sign-out functionality
- Silent token acquisition for API calls

### 2. Data Fetching

- Connect to SharePoint Excel file via Microsoft Graph API
- Support multiple tables (5 total, "RO Outside" is primary)
- Auto-refresh data every 60 seconds
- Manual refresh button

### 3. Dashboard Metrics

Display key metrics:

- Total parts out for repair
- Parts waiting for quotes
- Approved parts
- Parts ready for pickup
- Overdue updates (based on NEXT DATE TO UPDATE)
- Total outstanding value (sum of FINAL COST for approved items)

### 4. Data Table

- Display all repair orders with priority columns
- Search functionality (searches across all fields)
- Column sorting
- Pagination (20 items per page)
- Status badges with color coding
- Highlight overdue items (NEXT DATE TO UPDATE < today)
- Format currency values properly

### 5. Table Selector

- Dropdown to switch between all 5 Excel tables
- Remember selected table in session

## Key Requirements

### Performance

- Use React Query for caching and automatic refetching
- Implement pagination to handle large datasets
- Debounce search input

### Design

- Clean, professional interface
- Mobile-responsive (works on tablets/phones)
- Color-coded status indicators
- Clear visual hierarchy
- Accessible (WCAG 2.1 AA compliance)

### Error Handling

- Handle authentication errors gracefully
- Show user-friendly error messages for API failures
- Retry mechanisms for failed requests
- Loading states for all async operations

### Future Enhancements (not required now)

- Edit functionality to update status/notes
- Add new repair orders
- Email integration for status updates
- Advanced filtering (by shop, status, date range)
- Export to CSV/PDF
- Mobile app version

## Development Guidelines

### Code Style

- Use functional components with hooks
- Implement proper error boundaries
- Keep components small and focused
- Use meaningful variable names
- Add comments for complex logic
- Use TypeScript if possible (optional)

### State Management

- Use React Query for server state
- Use useState for local component state
- Avoid prop drilling (consider context for deep props)

### API Calls

- Abstract all Graph API calls in excelService.js
- Handle rate limiting
- Implement proper error handling
- Use async/await consistently

### Security

- Never store tokens in localStorage (use sessionStorage via MSAL)
- Validate all user inputs
- Don't expose sensitive data in console logs
- Follow MSAL security best practices

## Testing Checklist

- [ ] Authentication flow works (sign in/out)
- [ ] Data loads from SharePoint Excel
- [ ] All 5 tables are accessible via dropdown
- [ ] Search functionality works across all fields
- [ ] Sorting works on all columns
- [ ] Pagination displays correct data
- [ ] Metrics calculate correctly
- [ ] Status badges display with correct colors
- [ ] Overdue items are highlighted
- [ ] Refresh button updates data
- [ ] Auto-refresh works every 60 seconds
- [ ] Mobile responsive on different screen sizes
- [ ] Error states display properly
- [ ] Loading states show during data fetch

## Common Issues and Solutions

### Issue: "File not found" error

- Verify VITE_SHAREPOINT_SITE_URL is correct
- Ensure VITE_EXCEL_FILE_NAME includes .xlsx extension
- Check that the app has permissions to access the file
- Verify the file is actually in SharePoint, not just OneDrive

### Issue: Authentication fails

- Check redirect URI matches exactly (http://localhost:5173)
- Verify Client ID and Tenant ID are correct
- Ensure API permissions are granted and admin consented
- Clear browser cache and try again

### Issue: Data doesn't load

- Check browser console for errors
- Verify Graph API permissions are granted
- Ensure Excel data is in proper Table format (not just range)
- Check network tab for API response details

### Issue: "CORS error"

- This shouldn't happen with Graph API, but if it does:
- Verify using correct Graph API endpoints
- Check authentication token is being sent correctly

## Deployment Notes (For Future Reference)

### Local Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run preview  # Test production build locally
```

### Deploy to Azure Static Web Apps

1. Update redirect URI in Azure AD to production URL
2. Add production environment variables
3. Push to GitHub
4. Connect Azure Static Web App to GitHub repo
5. Automatic deployment on push to main branch

### Deploy to Vercel

1. Update redirect URI in Azure AD
2. Connect Vercel to GitHub repo
3. Add environment variables in Vercel dashboard
4. Deploy

## API Reference

### Microsoft Graph API Endpoints Used

```
GET /sites/root:{site-path}
GET /sites/{site-id}/drive/root/search(q='{filename}')
GET /drives/{drive-id}/items/{item-id}/workbook/tables
GET /drives/{drive-id}/items/{item-id}/workbook/tables/{table-name}/rows
GET /drives/{drive-id}/items/{item-id}/workbook/tables/{table-name}/headerRowRange
PATCH /drives/{drive-id}/items/{item-id}/workbook/tables/{table-name}/rows/itemAt(index={row-index})
POST /drives/{drive-id}/items/{item-id}/workbook/tables/{table-name}/rows/add
```

## Contact and Support

For questions about:

- Excel data structure: Check the original Excel file
- Azure AD setup: Refer to Azure portal app registration
- Graph API: https://docs.microsoft.com/en-us/graph/api/overview
- MSAL React: https://github.com/AzureAD/microsoft-authentication-library-for-js

## Version History

- v1.0 - Initial dashboard with read-only data display
- v1.1 - (Future) Add edit functionality
- v1.2 - (Future) Add email automation integration
- v2.0 - (Future) Mobile app version

## Notes for Claude

- All code files have been provided in artifacts
- Excel service includes methods for reading and updating data
- Dashboard calculates metrics from the data
- Table component handles search, sort, and pagination
- Status badges are color-coded for easy visual scanning
- The app is designed to be mobile-responsive from the start
- Focus on code quality and maintainability
- Add error handling for all API calls
- Keep the UI clean and professional
- Prioritize user experience and performance
