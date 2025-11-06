# GenThrust RO Tracker

A modern web application for tracking aircraft parts sent to repair stations. Replaces manual Excel tracking with a clean, responsive interface that syncs with SharePoint.

## Project Overview

The GenThrust RO Tracker is a React-based dashboard that provides real-time visibility into repair orders (ROs) for aircraft parts. It connects directly to an Excel file stored in SharePoint, allowing teams to view, search, filter, and create repair orders through an intuitive web interface instead of manually editing spreadsheets.

### Key Benefits
- **Real-time Data**: Directly reads from and writes to SharePoint Excel files
- **Better UX**: Clean, responsive interface with search, sort, and filter capabilities
- **Multi-user**: Secure Microsoft authentication with Azure AD
- **Automatic Calculations**: Shows overdue ROs, days overdue, and status summaries
- **Professional UI**: Modern design with Tailwind CSS and shadcn/ui components

## Features

### Core Functionality
- **View All Repair Orders**: Browse all active repair orders in a searchable, sortable table
- **Dashboard Statistics**: Real-time overview of active ROs, overdue items, and status breakdowns
- **Create New ROs**: Add new repair orders with a guided form
- **Update Status**: Change repair order status and add notes
- **Search & Filter**: Find specific ROs by number, shop, part, or serial number
- **Overdue Tracking**: Visual indicators for overdue repair orders with days overdue count

### Authentication
- Microsoft Azure AD authentication
- Single Sign-On (SSO) with organizational accounts
- Secure token-based API access

## Tech Stack

### Frontend
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Tailwind CSS v3.4.1**: Utility-first CSS framework
- **shadcn/ui**: High-quality React component library

### Backend/Data
- **Microsoft Graph API**: SharePoint and Excel file access
- **Azure AD / MSAL**: Authentication and authorization
- **Excel Tables**: Data stored in SharePoint Excel file

### State Management & Data Fetching
- **TanStack Query (React Query)**: Server state management, caching, and synchronization
- **Sonner**: Toast notifications for user feedback

### UI Components
- **Lucide React**: Icon library
- **Radix UI**: Headless UI primitives for accessibility

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Application                          │ │
│  │  ├─ Components (UI)                                     │ │
│  │  ├─ Hooks (Data fetching with React Query)             │ │
│  │  ├─ Services (Excel/Graph API logic)                   │ │
│  │  └─ MSAL (Authentication)                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Microsoft Azure AD                          │
│             (Authentication & Authorization)                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Microsoft Graph API                         │
│      (API Gateway for SharePoint & Office 365)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SharePoint Online                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Book.xlsx (Excel File)                         │ │
│  │  └─ RepairTable (Excel Table with all RO data)         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Structure

### Main Components

#### `App.tsx`
- Root component
- Handles authentication state with MSAL
- Renders login page or dashboard based on auth state
- Displays company logo and header

#### `Dashboard.tsx`
- Shows summary statistics cards
- Displays: Total Active ROs, Overdue, Waiting Quote, Approved, Being Repaired, Shipping, Total Value
- Each stat card has color-coded backgrounds and icons
- Auto-refreshes when data changes

#### `ROTable.tsx`
- Main table component displaying all repair orders
- Features:
  - Search functionality (RO number, shop, part, serial)
  - Column sorting (RO number, next update date)
  - Overdue highlighting (red background)
  - "View Details" and "New RO" buttons
  - Shows count of filtered vs total ROs

#### `RODetailDialog.tsx`
- Modal dialog for viewing full RO details
- Shows all fields including dates, costs, status, notes
- "Update Status" button opens status update dialog
- Displays tracking information and shop references

#### `UpdateStatusDialog.tsx`
- Modal for updating RO status
- Status dropdown with predefined options (TO SEND, WAITING QUOTE, APPROVED, etc.)
- Optional notes field
- Auto-updates last updated date

#### `AddRODialog.tsx`
- Modal form for creating new repair orders
- Required fields: RO Number, Shop Name, Part Number, Serial Number, Part Description, Required Work
- Optional fields: Estimated Cost, Terms, Shop Reference Number
- Form validation
- Auto-sets initial status to "TO SEND"

#### `StatusBadge.tsx`
- Color-coded status badges
- Different colors and icons for each status type
- Overdue indicator with warning icon

### Custom Hooks

#### `useROs.ts`
- `useROs()`: Fetches all repair orders using React Query
- `useUpdateROStatus()`: Mutation for updating RO status
- `useAddRepairOrder()`: Mutation for creating new ROs
- `useDashboardStats()`: Calculates dashboard statistics from RO data
- Handles loading states, caching, and automatic refetching

## Code Logic Flow

### Authentication Flow

```
1. User opens app
   ↓
2. App checks if user is authenticated (MSAL)
   ↓
3a. NOT authenticated:
    - Show login page with company logo
    - User clicks "Sign in with Microsoft"
    - MSAL opens Microsoft login popup
    - User enters credentials
    - Azure AD validates and returns token
    - App stores token and redirects to dashboard
    ↓
3b. IS authenticated:
    - Skip to dashboard
    ↓
4. MSAL instance is passed to excelService
5. App ready to make Graph API calls
```

### Data Fetching Flow (Reading ROs)

```
1. ROTable or Dashboard component mounts
   ↓
2. useROs() hook triggers
   ↓
3. React Query checks cache
   - If fresh data exists, return immediately
   - If stale or no data, continue
   ↓
4. excelService.getRepairOrders() called
   ↓
5. excelService.getFileId():
   - Get SharePoint site info
   - Get drive ID (cached)
   - Search for Book.xlsx
   - Return file ID (cached)
   ↓
6. Graph API call: GET /workbook/tables/RepairTable/rows
   ↓
7. Response contains array of rows
   ↓
8. Parse each row:
   - Map Excel columns to RepairOrder type
   - Parse dates (Excel serial dates → Date objects)
   - Parse currency values
   - Calculate isOverdue and daysOverdue
   ↓
9. Return array of RepairOrder objects
   ↓
10. React Query caches result
    ↓
11. Component receives data and renders
```

### Creating a New RO Flow

```
1. User clicks "New RO" button
   ↓
2. AddRODialog opens
   ↓
3. User fills form and clicks "Create Repair Order"
   ↓
4. Form validation checks required fields
   ↓
5. useAddRepairOrder mutation triggers
   ↓
6. excelService.addRepairOrder(data) called
   ↓
7. Create Excel workbook session:
   - POST /workbook/createSession
   - Returns session ID
   - Session allows isolated edits
   ↓
8. Prepare new row data (22 columns):
   - Set RO Number, Shop, Part info (from form)
   - Set Date Made, Status Date (today)
   - Set Current Status ("TO SEND")
   - Set Last Updated (today)
   - Leave optional fields empty
   ↓
9. Graph API call with session:
   - POST /workbook/tables/RepairTable/rows/add
   - Header: workbook-session-id
   - Body: { values: [newRow] }
   ↓
10. Excel adds row to table
    ↓
11. Close workbook session:
    - POST /workbook/closeSession
    ↓
12. React Query invalidates cache
    ↓
13. Automatic refetch of all ROs
    ↓
14. Dashboard and table update with new RO
    ↓
15. Show success toast notification
    ↓
16. Close dialog and reset form
```

### Updating RO Status Flow

```
1. User clicks "View Details" on RO
   ↓
2. RODetailDialog opens
   ↓
3. User clicks "Update Status"
   ↓
4. UpdateStatusDialog opens
   ↓
5. User selects new status and optionally adds notes
   ↓
6. User clicks "Update Status"
   ↓
7. useUpdateROStatus mutation triggers
   ↓
8. excelService.updateROStatus(rowIndex, status, notes)
   ↓
9. Create workbook session
   ↓
10. Get current row data:
    - GET /workbook/tables/RepairTable/rows/itemAt(index=X)
    ↓
11. Modify specific columns:
    - Column 13: New status
    - Column 14: Status date (today)
    - Column 18: Notes (if provided)
    - Column 19: Last updated (today)
    ↓
12. Update row:
    - PATCH /workbook/tables/RepairTable/rows/itemAt(index=X)
    - Body: { values: [modifiedRow] }
    ↓
13. Close workbook session
    ↓
14. React Query invalidates cache
    ↓
15. Automatic refetch of all ROs
    ↓
16. UI updates with new status
    ↓
17. Show success toast
    ↓
18. Close dialogs
```

## Excel Service Details

### `excelService.ts`
The core service that handles all SharePoint/Excel operations.

**Key Methods:**

- `setMsalInstance(instance)`: Initialize with MSAL for auth
- `getAccessToken()`: Gets Azure AD access token for Graph API calls
- `callGraphAPI(endpoint, method, body, useSession)`: Generic API caller with session support
- `getFileId()`: Finds and caches the Excel file ID
- `createSession()`: Creates isolated workbook edit session
- `closeSession()`: Closes workbook session
- `getRepairOrders()`: Fetches all ROs from Excel table
- `addRepairOrder(data)`: Adds new row to Excel table
- `updateROStatus(rowIndex, status, notes)`: Updates existing row

**Session Management:**
- Sessions provide isolated edit contexts
- Prevents conflicts with other users
- Uses `workbook-session-id` header
- Auto-closes in finally block

**Caching:**
- File ID cached to avoid repeated lookups
- Drive ID cached for performance
- Reduces API calls

**Date Handling:**
- Excel stores dates as serial numbers (days since 1/1/1900)
- Formula: `(serialDate - 25569) * 86400 * 1000`
- Converts to JavaScript Date objects

**Column Mapping:**
```
0:  RO Number
1:  Date Made
2:  Shop Name
3:  Part Number
4:  Serial Number
5:  Part Description
6:  Required Work
7:  Date Dropped Off
8:  Estimated Cost
9:  Final Cost
10: Terms
11: Shop Reference Number
12: Estimated Delivery Date
13: Current Status
14: Current Status Date
15: GenThrust Status
16: Shop Status
17: Tracking Number
18: Notes
19: Last Date Updated
20: Next Date to Update
21: Checked
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Azure AD app registration with permissions:
  - `User.Read`
  - `Files.ReadWrite`
  - `Sites.Read.All` (minimum) or `Sites.ReadWrite.All` (for full write access)
- SharePoint site with Excel file
- Excel file must have an **Excel Table** (not just a worksheet)

### Installation

1. **Clone the repository**
   ```bash
   cd repair-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env.local` file**
   ```env
   VITE_CLIENT_ID=your-azure-ad-client-id
   VITE_TENANT_ID=your-azure-ad-tenant-id
   VITE_SHAREPOINT_SITE_URL=https://yourcompany.sharepoint.com/sites/YourSite
   VITE_EXCEL_FILE_NAME=Book.xlsx
   VITE_EXCEL_TABLE_NAME=RepairTable
   ```

4. **Configure Azure AD App Registration**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to **Azure Active Directory** → **App registrations**
   - Create new registration or select existing
   - **Authentication**:
     - Add platform: Single-page application (SPA)
     - Redirect URI: `http://localhost:5173` (dev) and your production URL
     - Enable implicit grant: Access tokens, ID tokens
   - **API permissions**:
     - Add Microsoft Graph delegated permissions:
       - `User.Read`
       - `Files.ReadWrite`
       - `Sites.Read.All` or `Sites.ReadWrite.All`
     - Grant admin consent (may require admin)
   - Copy Client ID and Tenant ID to `.env.local`

5. **Set up SharePoint Excel File**
   - Upload Excel file to SharePoint document library
   - **IMPORTANT**: Data must be in an **Excel Table**, not just cells
   - To create Excel Table:
     - Select your data range
     - Insert → Table (or Ctrl+T)
     - Check "My table has headers"
     - Name the table (e.g., "RepairTable")
   - Ensure your account has **Edit** permissions on the file

6. **Run development server**
   ```bash
   npm run dev
   ```

7. **Open browser**
   - Navigate to `http://localhost:5173`
   - Sign in with your Microsoft account
   - Start tracking repair orders!

### Building for Production

```bash
npm run build
```

Outputs to `/dist` directory. Deploy to any static hosting service (Azure Static Web Apps, Netlify, Vercel, etc.).

## Project Structure

```
repair-dashboard/
├── src/
│   ├── assets/                 # Static assets
│   │   └── GENLOGO.png        # Company logo
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── label.tsx
│   │   │   └── badge.tsx
│   │   ├── Dashboard.tsx      # Statistics dashboard
│   │   ├── ROTable.tsx        # Main repair orders table
│   │   ├── RODetailDialog.tsx # RO details modal
│   │   ├── AddRODialog.tsx    # Create RO modal
│   │   ├── UpdateStatusDialog.tsx # Update status modal
│   │   └── StatusBadge.tsx    # Status display component
│   ├── hooks/                 # Custom React hooks
│   │   └── useROs.ts         # Data fetching hooks with React Query
│   ├── lib/                   # Core libraries and utilities
│   │   ├── excelService.ts   # Excel/SharePoint service
│   │   ├── msalConfig.ts     # Azure AD configuration
│   │   └── utils.ts          # Utility functions
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts          # RepairOrder, DashboardStats types
│   ├── App.tsx               # Root component
│   ├── main.tsx              # App entry point
│   └── index.css             # Global styles (Tailwind)
├── .env.local                # Environment variables (not committed)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
└── README.md                 # This file
```

## Key Technical Decisions

### Why React Query?
- Automatic caching and background updates
- Built-in loading and error states
- Automatic refetching on window focus
- Optimistic updates support
- Reduces boilerplate code

### Why Excel Tables vs Worksheets?
- Microsoft Graph API only supports Excel **Tables**, not raw worksheet ranges
- Tables provide structured, queryable data
- Automatic schema validation
- Better for programmatic access

### Why Workbook Sessions?
- Provides isolated edit context
- Prevents conflicts with concurrent users
- Recommended by Microsoft for write operations
- Ensures data consistency

### Why Tailwind CSS v3?
- Initial setup tried v4 but encountered PostCSS issues
- v3 is stable, well-documented, and widely supported
- Utility-first approach speeds up development
- Easy to customize and maintain

### Why shadcn/ui?
- Copy-paste component approach (full control)
- Built on Radix UI (excellent accessibility)
- Highly customizable
- No package bloat (only includes used components)

### Why MSAL Browser?
- Official Microsoft authentication library
- Handles token management automatically
- Supports SSO and silent token refresh
- Industry standard for Azure AD

## Common Issues & Solutions

### "Table not found" Error
- **Cause**: Data is in worksheet cells, not an Excel Table
- **Solution**: Select data → Insert → Table → Name it "RepairTable"

### "EditModeAccessDenied" Error
- **Cause**: No edit permissions on Excel file
- **Solution**: Check file permissions in SharePoint, ensure you have Edit access

### "access_denied" on Login
- **Cause**: API permissions need admin consent
- **Solution**: Azure AD admin must grant consent in App Registration

### Can't Log In / Popup Blocked
- **Cause**: Browser blocking popup window
- **Solution**: Allow popups for localhost or your domain

### Data Not Refreshing
- **Cause**: React Query cache not invalidating
- **Solution**: Click refresh button or wait for auto-refetch

## Future Enhancements

Potential features for future development:
- Edit existing ROs (not just status)
- Delete ROs
- Export to CSV/PDF
- Email notifications for overdue ROs
- File attachments (photos, documents)
- Bulk status updates
- Advanced filtering (date ranges, cost ranges)
- Repair history timeline
- Integration with Power Automate for workflows
- Mobile app version
- Offline support with sync

## Contributing

This is an internal GenThrust project. For questions or issues, contact the development team.

## License

Proprietary - GenThrust XVII Internal Use Only

---

**Built with ❤️ by Claude Code for GenThrust**
