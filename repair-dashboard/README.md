# Repair Station Dashboard

A modern React web application for tracking aircraft parts sent to repair stations. Data is stored in Excel files on SharePoint and accessed via Microsoft Graph API.

## Features

- **Microsoft Authentication**: Secure login using Azure AD/MSAL
- **Real-time Data**: Automatic refresh from SharePoint Excel files
- **Interactive Dashboard**: Key metrics and status overview
- **Advanced Table**: Search, sort, and pagination capabilities
- **Status Tracking**: Color-coded status badges with overdue alerts
- **Multi-table Support**: Switch between different Excel tables
- **Mobile Responsive**: Works on desktop, tablet, and mobile devices

## Technology Stack

- **Frontend**: React 18+ with Vite
- **Authentication**: Microsoft MSAL (Azure AD)
- **Data Source**: Excel file in SharePoint via Microsoft Graph API
- **Styling**: Tailwind CSS
- **State Management**: React Query (@tanstack/react-query)
- **Icons**: lucide-react

## Prerequisites

- Node.js 20.19+ or 22.12+
- Azure AD app registration with proper permissions
- SharePoint site with Excel file containing repair data

## Setup Instructions

### 1. Clone and Install

```bash
cd repair-dashboard
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
VITE_CLIENT_ID=your_azure_ad_app_client_id_here
VITE_TENANT_ID=your_azure_ad_tenant_id_here
VITE_SHAREPOINT_SITE_URL=https://yourcompany.sharepoint.com/sites/yoursite
VITE_EXCEL_FILE_NAME=your_excel_file.xlsx
```

### 3. Azure AD Configuration

Register an app in Azure AD with these settings:

- **Redirect URI**: `http://localhost:5173` (SPA)
- **API Permissions**:
  - Microsoft Graph: User.Read (Delegated)
  - Microsoft Graph: Files.Read (Delegated)
  - Microsoft Graph: Files.ReadWrite (Delegated)

### 4. Excel Data Structure

Your Excel file should contain tables with these columns:

- RO # (Repair Order Number)
- DATE MADE
- SHOP NAME (repair station name)
- PART # (part number)
- SERIAL # (serial number)
- PART DESCRIPTION
- REQ WORK (required work types)
- DATE DROPPED OFF
- ESTIMATED COST
- FINAL COST
- TERMS (payment terms)
- SHOP REF # (shop reference number)
- ESTIMATED DELIVERY DATE
- CURENT STATUS (repair status)
- CURENT STATUS DATE
- GENTHRUST STATUS
- SHOP STATUS
- TRACKING NUMBER / PICKING UP
- NOTES
- LAST DATE UPDATED
- NEXT DATE TO UPDATE

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Project Structure

```
repair-dashboard/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx       # Main dashboard with metrics
│   │   ├── RepairTable.jsx     # Data table with search/filter/sort
│   │   └── StatusBadge.jsx     # Status indicator component
│   ├── services/
│   │   ├── authConfig.js       # MSAL authentication config
│   │   └── excelService.js     # Excel/Graph API service layer
│   ├── App.jsx                 # Main app with authentication
│   ├── main.jsx                # Entry point with providers
│   └── index.css               # Tailwind imports
├── .env.example                # Environment template
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Key Components

### Dashboard
- Displays key metrics (total parts, waiting quotes, approved, etc.)
- Table selector for switching between Excel tables
- Manual refresh functionality
- Calculates overdue items and outstanding value

### RepairTable
- Search functionality across all fields
- Column sorting (dates, numbers, text)
- Pagination (20 items per page)
- Responsive design for mobile devices
- Highlights overdue items

### StatusBadge
- Color-coded status indicators
- Icons for different status types
- Overdue alerts with visual indicators

### ExcelService
- Handles all SharePoint/Graph API interactions
- Token management via MSAL
- Error handling and retry logic
- Support for multiple tables

## Status Types

- **WAITING QUOTE**: Yellow badge with quote icon
- **APPROVED >>>>**: Green badge with check icon
- **WAITING FOR PARTS**: Blue badge with clock icon
- **IN PROGRESS**: Purple badge with clock icon
- **READY FOR PICKUP**: Emerald badge with check icon
- **COMPLETED**: Gray badge with check icon
- **ON HOLD**: Orange badge with pause icon
- **CANCELLED**: Red badge with X icon

## Security

- Tokens stored in sessionStorage (managed by MSAL)
- No sensitive data in localStorage
- Proper error handling to prevent data leaks
- Azure AD permissions follow principle of least privilege

## Troubleshooting

### Authentication Issues
- Verify Client ID and Tenant ID are correct
- Check redirect URI matches exactly
- Ensure API permissions are granted and admin consented

### Data Loading Issues
- Verify SharePoint site URL is correct
- Check Excel file name includes .xlsx extension
- Ensure file is in proper Excel Table format
- Check browser console for API errors

### Build Issues
- Upgrade Node.js to version 20.19+ or 22.12+
- Clear node_modules and reinstall dependencies
- Check for TypeScript or linting errors

## Performance

- Data cached for 5 minutes (configurable)
- Auto-refresh every 60 seconds
- Pagination for large datasets
- Debounced search input
- Optimized bundle size with code splitting

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow existing code style and patterns
2. Use functional components with hooks
3. Implement proper error handling
4. Add comments for complex logic
5. Test on multiple browsers and devices

## License

Private project for Genthrust Repairs.
