# GenThrust RO Tracker

A modern, AI-powered web application for tracking aircraft parts sent to repair stations. Replaces manual Excel tracking with an intelligent, responsive interface that syncs with SharePoint and provides automated workflows, smart reminders, and natural language command processing.

## Project Overview

The GenThrust RO Tracker is a comprehensive React-based dashboard that provides real-time visibility and intelligent automation for repair orders (ROs) of aircraft parts. It seamlessly integrates with Microsoft 365 services (SharePoint, Excel, Outlook, To Do) and features an AI assistant powered by Claude for natural language interaction and automated workflows.

### Key Benefits
- **AI-Powered Assistant**: Natural language commands via Claude AI (Ctrl+K)
- **Real-time Data**: Directly reads from and writes to SharePoint Excel files
- **Intelligent Automation**: Smart reminders, payment tracking, automatic archiving
- **Multi-Sheet Management**: Active, Paid, NET, and Returns tracking
- **Shop Directory**: Complete repair facility database with contact management
- **Email Integration**: Built-in email composer with templates
- **File Attachments**: Upload and manage documents per RO
- **Advanced Analytics**: Dashboard with KPIs, trends, and overdue tracking
- **Dark Mode**: Full dark/light theme support
- **Mobile Responsive**: Optimized for all devices
- **Secure**: Microsoft Azure AD authentication with MFA support

## Features

### 🤖 AI Assistant (NEW!)
- **Natural Language Interface**: Talk to your repair orders in plain English
- **Keyboard Shortcut**: Press `Ctrl+K` anywhere to open AI Assistant
- **Powerful AI Tools**:
  - Update repair orders (status, cost, tracking, notes)
  - Query and filter ROs with natural language
  - Send reminder emails to shops
  - Get RO summaries and analytics
  - Archive completed repair orders
- **Streaming Responses**: Real-time AI feedback as you type
- **Context-Aware**: AI understands your RO and shop data
- **Activity Logs**: Review all AI actions in text or Excel format

### 📊 Core Repair Order Management
- **Active RO Tracking**: Real-time view of all in-progress repair orders
- **Multi-Sheet Archiving**:
  - **Paid Sheet**: Received and fully paid ROs
  - **NET Sheet**: Received ROs awaiting NET payment (30/60/90 days)
  - **Returns Sheet**: BER (Beyond Economic Repair), RAI (Return As Is), Cancelled
- **Smart Archiving**: Automatically routes ROs based on payment terms and status
- **Status Lifecycle Management**:
  - TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED
  - CURRENTLY BEING SHIPPED (inbound to shop), RECEIVED
  - SHIPPING (outbound to customer), PAID, PAYMENT SENT
  - RAI, BER
- **Status History Timeline**: Visual timeline of all status changes with dates, costs, and notes
- **Approval Gates**: Confirmation dialogs for critical archival actions
- **Business Rules Engine**: Automatic next update date calculation per status

### 🏪 Shop Directory (NEW!)
- **Complete Shop Database**: Manage repair facilities and vendors
- **Shop Details**:
  - Customer number, business name, full address
  - Phone, toll-free, fax, email, website
  - Primary contact person
  - Payment terms (NET, COD, Prepaid, etc.)
  - ILS code, last sale date, YTD sales
- **Search & Filter**: Find shops by name, contact, email, location
- **CRUD Operations**: Add, edit, delete shop records
- **Integration**: Link ROs to shops with automatic lookup

### 📧 Email Integration (NEW!)
- **Built-in Email Composer**: Send emails directly from the dashboard
- **Dynamic Templates**:
  - Quote request emails
  - Follow-up status updates
  - Approval confirmations
  - Custom templates per RO status
- **Template Customization**: Edit subject, body, recipients before sending
- **Email from RO Details**: One-click email to shop from RO view
- **Email Logging**: Track sent emails (planned)

### 📎 File Attachments (NEW!)
- **RO Document Management**: Upload files to any repair order
- **Drag-and-Drop Upload**: Easy file attachment
- **Multi-File Upload**: Batch upload multiple documents
- **Storage Options**:
  - OneDrive (simple setup)
  - SharePoint (enterprise organization)
- **File Operations**: Upload, download, delete, view metadata
- **Organized Folders**: Files auto-organized by RO number
- **Metadata Tracking**: Created/modified dates, user, file size

### ⏰ Smart Reminders (NEW!)
- **Multiple Reminder Types**:
  - Microsoft To Do tasks
  - Outlook Calendar events
  - Combined (both To Do and Calendar)
- **Automatic Scheduling**: Next update date calculated by business rules
- **NET Payment Reminders**: Auto-create calendar events for NET30/60/90 payments
- **Status-Based Follow-ups**:
  - TO SEND: 3 days
  - WAITING QUOTE: 14 days
  - APPROVED: 7 days
  - BEING REPAIRED: 10 days
  - CURRENTLY BEING SHIPPED: 5 days
  - RECEIVED: 3 days
  - SHIPPING: 3 days
  - PAID: Based on payment terms

### 📈 Dashboard & Analytics
- **Real-time Statistics**:
  - Total Active ROs, Overdue count
  - Waiting for Quote, Approved, Being Repaired, Shipping
  - Today's Due, 30+ Days Overdue
  - On Track count
  - Total & Estimated Values
- **Archive Statistics**:
  - Approved/Paid, Approved/NET
  - RAI, BER, Cancelled
- **Visual KPI Cards**: Color-coded cards with icons
- **Trend Indicators**: See changes at a glance

### 🔍 Advanced Search & Filtering
- **Multi-Column Search**: Search across RO number, shop, part, serial number, description
- **Smart Filters**:
  - Overdue ROs only
  - Due this week
  - High value (>$5000)
  - Filter by shop
  - Waiting for action
  - Clear all filters
- **Active Filter Count**: See how many filters applied
- **Column Sorting**: Sort by RO number, status, date, cost

### 📦 Inventory File Viewer (NEW!)
- **Genthrust Inventory Access**: View and access company inventory file
- **File Discovery**: Automatic SharePoint file search
- **Workbook Structure**: Display worksheets, tables, and columns
- **External Link**: Open inventory directly in Excel Online

### 🎨 User Experience
- **Dark/Light Mode**: Full theme support with system preference detection
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Toast Notifications**: User-friendly feedback with Sonner
- **Loading States**: Skeleton loaders and spinners
- **Confirmation Dialogs**: Prevent accidental actions
- **Keyboard Shortcuts**: Ctrl+K for AI Assistant
- **Smooth Animations**: Modern transitions and effects

### 🔐 Authentication & Security
- **Microsoft Azure AD**: Enterprise-grade authentication
- **Single Sign-On (SSO)**: Use your organization account
- **Multi-Factor Authentication (MFA)**: Additional security layer
- **Scope-Based Permissions**: Granular API access control
- **Token Management**: Automatic refresh, silent acquisition
- **No Hardcoded Secrets**: All credentials in environment variables

### 🔧 Bulk Operations
- **Multi-Select**: Select multiple ROs with checkboxes
- **Batch Actions**:
  - Bulk status updates
  - Batch archiving
  - Export to CSV
  - Bulk delete (planned)

## Tech Stack

### Frontend
- **React 19.1** - Latest React with concurrent features
- **TypeScript 5.9** - Type-safe development
- **Vite 7** - Lightning-fast build tool and dev server
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **Shadcn/UI** - High-quality, accessible React components
- **Radix UI** - Headless UI primitives for accessibility

### AI & LLM
- **Anthropic Claude** - Claude Sonnet 4 AI model
- **Streaming SDK** - Real-time response streaming
- **Tool Use API** - Structured function calling
- **Context Management** - Maintains conversation history

### Backend/Data
- **Microsoft Graph API** - SharePoint, Excel, OneDrive, Outlook access
- **Azure AD / MSAL** - Authentication and authorization
- **Excel Tables** - Structured data in SharePoint Excel files
- **Microsoft To Do API** - Task reminders
- **Microsoft Calendar API** - Calendar event reminders

### State Management & Data Fetching
- **TanStack Query (React Query) 5.90** - Server state, caching, synchronization
- **Sonner** - Beautiful toast notifications

### UI Libraries
- **Lucide React** - Beautiful icon library (550+ icons)
- **class-variance-authority** - Component variant management
- **tailwind-merge** - Intelligent class merging

### Development Tools
- **Vitest** - Fast unit test runner
- **React Testing Library** - Component testing
- **ESLint** - Code quality and consistency
- **TypeScript ESLint** - TypeScript-specific linting

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User's Browser                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   React Application                             │ │
│  │  ├─ Components (UI, Dialogs, Tables)                           │ │
│  │  ├─ Hooks (Data fetching with React Query)                     │ │
│  │  ├─ Services (Excel, SharePoint, AI, Email, Reminders)        │ │
│  │  ├─ AI Agent (Claude Sonnet 4 with tool use)                  │ │
│  │  └─ MSAL (Authentication)                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       Microsoft Azure AD                             │
│                (Authentication & Authorization)                      │
│                     Multi-Factor Authentication                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┬──────────────────┐
                ↓               ↓               ↓                  ↓
    ┌──────────────────┐ ┌────────────┐ ┌─────────────┐ ┌────────────────┐
    │  Anthropic API   │ │  Graph API │ │  To Do API  │ │  Calendar API  │
    │  (Claude AI)     │ │ (SharePoint│ │ (Reminders) │ │  (Events)      │
    └──────────────────┘ │  & Excel)  │ └─────────────┘ └────────────────┘
                         └────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        SharePoint Online                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Book.xlsx (Main Excel File)                                   │ │
│  │    ├─ RepairTable (Active repair orders)                       │ │
│  │    ├─ Paid (Completed & paid ROs)                              │ │
│  │    ├─ NET (Received, awaiting NET payment)                     │ │
│  │    └─ Returns (BER, RAI, Cancelled)                            │ │
│  │                                                                  │ │
│  │  Shops.xlsx (Shop Directory)                                    │ │
│  │    └─ ShopsTable (All repair facilities)                       │ │
│  │                                                                  │ │
│  │  Genthrust_Inventory.xlsx (Inventory File)                      │ │
│  │                                                                  │ │
│  │  RO Attachments/ (Document folders by RO number)               │ │
│  │    ├─ RO-12345/ (files for RO 12345)                           │ │
│  │    ├─ RO-12346/ (files for RO 12346)                           │ │
│  │    └─ ...                                                       │ │
│  │                                                                  │ │
│  │  AI_Logs/ (Daily AI activity logs)                             │ │
│  │    ├─ AI_Log_2025-01-13.xlsx                                   │ │
│  │    └─ ...                                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Structure

### Main Views
- **`App.tsx`** - Root component, authentication, navigation
- **`Dashboard.tsx`** - KPI cards, statistics, analytics
- **`ROTable.tsx`** - Main repair orders table with search, filter, sort
- **`ShopDirectory.tsx`** - Shop management interface

### Dialogs & Modals
- **`RODetailDialog.tsx`** - Comprehensive RO details with tabs
- **`AddRODialog.tsx`** - Create new RO or edit existing
- **`UpdateStatusDialog.tsx`** - Change status with validation and archiving
- **`ApprovalDialog.tsx`** - Confirm archival decisions
- **`ArchiveDestinationDialog.tsx`** - Choose PAID vs NET for unclear payment terms
- **`EmailComposerDialog.tsx`** - Draft and send emails to shops
- **`ReminderTypeDialog.tsx`** - Choose reminder type (To Do, Calendar, Both)
- **`ShopManagementDialog.tsx`** - Add/edit shop information
- **`LogsDialog.tsx`** - View AI activity logs

### Feature Components
- **`AIAgentDialog.tsx`** - Main AI assistant interface with streaming
- **`AttachmentManager.tsx`** - File upload, download, delete interface
- **`StatusTimeline.tsx`** - Visual status history timeline
- **`StatusBadge.tsx`** - Color-coded status indicators
- **`BulkActionsBar.tsx`** - Multi-select action toolbar
- **`InventoryFileViewer.tsx`** - Inventory file display
- **`ThemeToggle.tsx`** - Dark/light mode switcher

### UI Components (shadcn/ui)
- Button, Card, Badge, Input, Label, Checkbox
- Dialog, Textarea, Table, Select, Dropdown Menu

### Custom Hooks

#### Data Fetching
- **`useROs()`** - Fetch all active repair orders
- **`useArchivedROs(sheetName)`** - Fetch from specific archive
- **`useShops()`** - Fetch all shops
- **`useDashboardStats()`** - Calculate dashboard metrics
- **`useInventoryFile()`** - Search and access inventory file
- **`useAttachments(roNumber)`** - Fetch RO attachments

#### Data Mutations
- **`useUpdateROStatus()`** - Update RO status
- **`useAddRepairOrder()`** - Create new RO
- **`useUpdateRepairOrder()`** - Edit existing RO
- **`useBulkUpdateStatus()`** - Batch status updates
- **`useArchiveRO()`** - Move RO to archive sheet
- **`useDeleteRepairOrder()`** - Delete RO
- **`useAddShop()`, `useUpdateShop()`, `useDeleteShop()`** - Shop CRUD
- **`useUploadAttachment()`, `useDeleteAttachment()`** - File operations

#### Filters & State
- **`useROFilters()`** - Manage filter state and active count
- **`useTheme()`** - Theme state and toggle

## Services

### Core Services

#### `excelService.ts`
Handles all SharePoint/Excel operations for repair orders.

**Key Methods:**
- `getRepairOrders()` - Fetch all ROs from Excel table
- `addRepairOrder(data)` - Add new RO row
- `updateROStatus(rowIndex, status, notes, cost, deliveryDate)` - Update RO fields
- `appendNote(rowIndex, note)` - Add note to existing RO
- `moveROToArchive(rowIndex, targetSheet, targetTable)` - Archive RO
- `deleteRepairOrder(rowIndex)` - Delete RO
- `searchForFile(fileName)` - Find file in SharePoint
- `listFileStructure(fileId)` - Get workbook structure

**Session Management:**
- Creates isolated workbook sessions for write operations
- Prevents conflicts with concurrent users
- Auto-closes in finally blocks

**Date Handling:**
- Excel serial dates ↔ JavaScript Date conversion
- Formula: `(serialDate - 25569) * 86400 * 1000`

#### `shopService.ts`
Manages shop/repair facility data.

**Methods:**
- `getShops()` - Fetch all shops
- `addShop(data)` - Create new shop
- `updateShop(rowIndex, data)` - Edit shop
- `deleteShop(rowIndex)` - Remove shop

#### `sharePointService.ts`
Handles file attachments and document management.

**Methods:**
- `uploadFile(roNumber, file)` - Upload attachment
- `uploadMultipleFiles(roNumber, files)` - Batch upload
- `listFiles(roNumber)` - Get RO attachments
- `deleteFile(fileId)` - Remove attachment
- `downloadFile(fileId)` - Download file
- `getROFolderUrl(roNumber)` - Get SharePoint folder URL

**Storage Options:**
- SharePoint: Enterprise document libraries
- OneDrive: Simple setup for small teams

#### `reminderService.ts`
Creates reminders and calendar events.

**Methods:**
- `createToDoTask(title, dueDate, notes)` - Microsoft To Do task
- `createCalendarEvent(title, startDate, notes)` - Outlook calendar event
- `createPaymentDueCalendarEvent({roNumber, shopName, amount, netDays})` - NET payment reminder

#### `loggingService.ts`
Logs AI interactions to SharePoint/OneDrive.

**Methods:**
- `logAIInteraction(action, details, result)` - Log AI action
- `getAILogs(date)` - Retrieve daily logs
- Automatic Excel file creation with formatted entries

#### `anthropicAgent.ts`
Claude AI integration for natural language processing.

**Features:**
- Claude Sonnet 4 model
- Streaming responses
- Tool use with structured schemas
- Multi-turn conversations
- Context-aware with RO and shop data

**Methods:**
- `processCommand(userMessage, context)` - Process natural language command
- `continueConversation(messages)` - Multi-turn chat
- Handles tool execution and response streaming

#### `aiTools.ts`
Defines AI tool schemas and executors.

**Available Tools:**
1. **`update_repair_order`** - Update status, cost, tracking, notes, dates
2. **`query_repair_orders`** - Filter ROs by status, shop, date, cost, overdue
3. **`send_reminder_email`** - Email shops for status updates
4. **`get_repair_order_summary`** - Summarize RO details
5. **`archive_repair_order`** - Move completed ROs to archive
6. **`create_repair_order`** - Add new RO (planned)

## Business Rules

### Status-Based Next Update Calculation

Implemented in `businessRules.ts`:

- **TO SEND**: Follow up in 3 days to confirm shipment
- **WAITING QUOTE**: Follow up in 14 days for quote
- **APPROVED**: Follow up in 7 days to check repair start
- **BEING REPAIRED**: Follow up in 10 days for progress
- **CURRENTLY BEING SHIPPED**: Follow up in 5 days for inbound delivery
- **RECEIVED**: Follow up in 3 days for payment processing
- **SHIPPING**: Follow up in 3 days to track delivery
- **PAID**: Based on payment terms
  - NET 30/60/90: Payment due in X days
  - COD/Prepaid/Credit Card: No follow-up (complete)
  - Wire Transfer: 3 days for processing
  - Unknown terms: Default 30 days
- **PAYMENT SENT**: Order complete, no follow-up
- **BER**: No follow-up needed

### Payment Terms Processing

Implemented in `excelSheets.ts`:

- **NET Detection**: Regex pattern `NET\s*(\d+)` extracts days
  - "NET 30", "NET30", "Net 60" → 30, 30, 60 days
- **Term Types**:
  - COD (Cash on Delivery)
  - Prepaid
  - Credit Card
  - Wire Transfer / XFER
  - NET 30/60/90

### Archival Rules

Determined by status and payment terms:

- **RECEIVED Status**:
  - NET payment terms → NET archive (with payment reminder)
  - Other payment terms → PAID archive
  - Unclear/no terms → Prompt user to choose
- **PAID/PAYMENT SENT**:
  - PAID archive
- **BER/RAI**:
  - Returns archive
- **Other Statuses**:
  - Remain in Active sheet

### Status Colors

- **TO SEND**: Blue
- **WAITING QUOTE**: Yellow
- **APPROVED**: Green
- **BEING REPAIRED**: Purple
- **CURRENTLY BEING SHIPPED**: Cyan
- **RECEIVED**: Teal
- **SHIPPING**: Indigo
- **PAID/PAYMENT SENT**: Gray
- **BER**: Slate
- **Overdue**: Red (overrides status color)

## Data Models

### RepairOrder
```typescript
interface RepairOrder {
  // Identifiers
  id: string;
  roNumber: string;

  // Dates
  dateMade: Date;
  dateDroppedOff?: Date;
  estimatedDeliveryDate?: Date;
  currentStatusDate: Date;
  lastDateUpdated: Date;
  nextDateToUpdate: Date | null;

  // Shop & Part Info
  shopName: string;
  partNumber: string;
  serialNumber: string;
  partDescription: string;
  requiredWork: string;
  shopReferenceNumber?: string;

  // Costs
  estimatedCost?: number;
  finalCost?: number;
  terms?: string; // Payment terms

  // Status
  currentStatus: string;
  genThrustStatus?: string;
  shopStatus?: string;
  trackingNumber?: string;

  // Notes & History
  notes?: string;
  statusHistory?: StatusHistoryEntry[];

  // Calculated
  isOverdue: boolean;
  daysOverdue: number;
  checked?: boolean;
}
```

### Shop
```typescript
interface Shop {
  id: string;
  customerNumber: string;
  businessName: string;

  // Address
  addressLines: string[];
  city: string;
  state: string;
  zip: string;
  country: string;

  // Contact
  phone: string;
  tollFree?: string;
  fax?: string;
  email: string;
  website?: string;
  contact: string; // Primary contact name

  // Business
  paymentTerms: string;
  ilsCode?: string;
  lastSaleDate?: Date;
  ytdSales?: number;
}
```

### StatusHistoryEntry
```typescript
interface StatusHistoryEntry {
  status: string;
  date: Date;
  user: string;
  cost?: number;
  notes?: string;
  deliveryDate?: Date;
}
```

### DashboardStats
```typescript
interface DashboardStats {
  // Active RO Metrics
  totalActive: number;
  overdue: number;
  waitingQuote: number;
  approved: number;
  beingRepaired: number;
  shipping: number;
  dueToday: number;
  overdue30Plus: number;
  onTrack: number;

  // Financial
  totalValue: number;
  estimatedValue: number;

  // Archive Stats
  archiveStats: {
    approvedPaid: number;
    approvedNet: number;
    rai: number;
    ber: number;
    cancelled: number;
  };
}
```

## Excel Column Mapping

### RepairTable (Active Sheet)
```
Column Index  Field Name
────────────────────────────────────────
0             RO Number
1             Date Made
2             Shop Name
3             Part Number
4             Serial Number
5             Part Description
6             Required Work
7             Date Dropped Off
8             Estimated Cost
9             Final Cost
10            Terms (Payment Terms)
11            Shop Reference Number
12            Estimated Delivery Date
13            Current Status
14            Current Status Date
15            GenThrust Status
16            Shop Status
17            Tracking Number
18            Notes
19            Last Date Updated
20            Next Date to Update
21            Checked
```

## Setup Instructions

### Prerequisites
- **Node.js 18+** and npm
- **Azure AD App Registration** with permissions:
  - `User.Read` - User profile access
  - `Files.ReadWrite.All` - Excel file read/write
  - `Sites.Read.All` - SharePoint site access
  - `Tasks.ReadWrite` - Microsoft To Do
  - `Calendars.ReadWrite` - Outlook Calendar
- **SharePoint Site** with Excel files
- **Excel Tables** (not just worksheets) for data storage
- **Anthropic API Key** for Claude AI

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
   # Azure AD / MSAL Configuration
   VITE_CLIENT_ID=your-azure-ad-client-id
   VITE_TENANT_ID=your-azure-ad-tenant-id

   # SharePoint Configuration
   VITE_SHAREPOINT_SITE_URL=https://yourcompany.sharepoint.com/sites/YourSite
   VITE_EXCEL_FILE_NAME=Book.xlsx
   VITE_EXCEL_TABLE_NAME=RepairTable
   VITE_SHOPS_FILE_NAME=Shops.xlsx
   VITE_SHOPS_TABLE_NAME=ShopsTable

   # Anthropic AI Configuration
   VITE_ANTHROPIC_API_KEY=sk-ant-api03-...

   # Storage Configuration (optional)
   VITE_STORAGE_TYPE=sharepoint  # or "onedrive"
   VITE_SHAREPOINT_SITE_ID=your-site-id  # if using SharePoint storage
   ```

4. **Configure Azure AD App Registration**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to **Azure Active Directory** → **App registrations**
   - Create new registration or select existing
   - **Authentication**:
     - Platform: Single-page application (SPA)
     - Redirect URIs:
       - `http://localhost:5173` (development)
       - Your production URL
     - Implicit grant: Enable Access tokens and ID tokens
   - **API permissions** (Microsoft Graph delegated):
     - `User.Read` (default)
     - `Files.ReadWrite.All`
     - `Sites.Read.All`
     - `Tasks.ReadWrite`
     - `Calendars.ReadWrite`
     - Click "Grant admin consent"
   - Copy **Client ID** and **Tenant ID** to `.env.local`

5. **Set up SharePoint Excel Files**

   **Book.xlsx (Repair Orders):**
   - Upload Excel file to SharePoint document library
   - **IMPORTANT**: Create Excel Tables (not just worksheets):
     - Select data range → Insert → Table (Ctrl+T)
     - Check "My table has headers"
     - Name tables:
       - Active repairs: `RepairTable`
       - Paid archive: `Paid`
       - NET archive: `NET`
       - Returns archive: `Returns`
   - Column headers must match the mapping above

   **Shops.xlsx (Shop Directory):**
   - Create Excel table named `ShopsTable`
   - Required columns:
     - Customer Number, Business Name, Address Lines
     - City, State, Zip, Country
     - Phone, Email, Contact, Payment Terms

   **Permissions:**
   - Ensure your account has **Edit** permissions on files
   - All users need at least **Read** access

6. **Get Anthropic API Key**
   - Sign up at [anthropic.com](https://console.anthropic.com)
   - Create API key
   - Add to `.env.local` as `VITE_ANTHROPIC_API_KEY`

7. **Run development server**
   ```bash
   npm run dev
   ```

8. **Open browser**
   - Navigate to `http://localhost:5173`
   - Sign in with your Microsoft account
   - Press **Ctrl+K** to test the AI Assistant
   - Start tracking repair orders!

### Building for Production

```bash
npm run build
```

Outputs to `/dist` directory. Deploy to:
- Azure Static Web Apps (recommended)
- Netlify
- Vercel
- Any static hosting service

**Production Environment Variables:**
- Set all `VITE_*` variables in your hosting platform
- Ensure Azure AD redirect URI matches production URL
- Update CORS settings if needed

## Project Structure

```
repair-dashboard/
├── src/
│   ├── assets/                    # Static assets
│   │   └── GENLOGO.png           # Company logo
│   │
│   ├── components/               # React components
│   │   ├── ui/                  # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── table.tsx
│   │   │   ├── select.tsx
│   │   │   └── dropdown-menu.tsx
│   │   ├── Dashboard.tsx         # Statistics dashboard
│   │   ├── ROTable.tsx          # Main repair orders table
│   │   ├── RODetailDialog.tsx   # RO details modal
│   │   ├── AddRODialog.tsx      # Create/edit RO modal
│   │   ├── UpdateStatusDialog.tsx    # Update status
│   │   ├── ApprovalDialog.tsx   # Archive approval
│   │   ├── ArchiveDestinationDialog.tsx  # PAID vs NET
│   │   ├── StatusBadge.tsx      # Status display
│   │   ├── StatusTimeline.tsx   # Status history
│   │   ├── ShopDirectory.tsx    # Shop management
│   │   ├── ShopManagementDialog.tsx  # Add/edit shops
│   │   ├── EmailComposerDialog.tsx   # Email interface
│   │   ├── ReminderTypeDialog.tsx    # Reminder options
│   │   ├── AIAgentDialog.tsx    # AI assistant
│   │   ├── LogsDialog.tsx       # AI activity logs
│   │   ├── AttachmentManager.tsx     # File uploads
│   │   ├── BulkActionsBar.tsx   # Multi-select actions
│   │   ├── InventoryFileViewer.tsx   # Inventory file
│   │   └── ThemeToggle.tsx      # Dark/light mode
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useROs.ts           # RO data fetching & mutations
│   │   ├── useShops.ts         # Shop data
│   │   ├── useROFilters.ts     # Filter state management
│   │   ├── useInventoryFile.ts # Inventory file access
│   │   └── useTheme.ts         # Theme state
│   │
│   ├── lib/                     # Core libraries
│   │   ├── excelService.ts     # Excel/SharePoint service
│   │   ├── shopService.ts      # Shop CRUD operations
│   │   ├── reminderService.ts  # To Do & Calendar
│   │   ├── loggingService.ts   # AI logging
│   │   ├── businessRules.ts    # Status & date logic
│   │   ├── emailTemplates.ts   # Email generation
│   │   ├── trackingUtils.ts    # Carrier detection
│   │   ├── exportUtils.ts      # CSV export
│   │   ├── msalConfig.ts       # Azure AD config
│   │   └── utils.ts            # Utility functions
│   │
│   ├── services/               # Backend services
│   │   ├── anthropicAgent.ts   # Claude AI integration
│   │   ├── aiTools.ts          # AI tool definitions
│   │   ├── aiParser.ts         # Command parsing
│   │   └── sharepoint.ts       # File attachments
│   │
│   ├── config/                 # Configuration
│   │   ├── anthropic.ts        # AI settings
│   │   ├── excelSheets.ts      # Sheet definitions
│   │   └── sharepoint.ts       # Storage config
│   │
│   ├── types/                  # TypeScript types
│   │   ├── index.ts           # Core types
│   │   ├── aiAgent.ts         # AI types
│   │   └── aiCommand.ts       # Command types
│   │
│   ├── App.tsx                # Root component
│   ├── main.tsx               # App entry point
│   └── index.css              # Global styles
│
├── .env.local                 # Environment variables (gitignored)
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite config
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.js         # PostCSS config
├── components.json           # shadcn/ui config
└── README.md                 # This file
```

## Key Technical Decisions

### Why Claude AI (Anthropic)?
- State-of-the-art natural language understanding
- Tool use API for structured function calling
- Streaming responses for real-time feedback
- 200K token context window (handles large datasets)
- Strong reasoning capabilities for complex workflows

### Why React Query (TanStack Query)?
- Automatic caching and background updates
- Built-in loading and error states
- Automatic refetching on window focus
- Optimistic updates support
- Reduces boilerplate by 80%

### Why Excel Tables vs Worksheets?
- Microsoft Graph API only supports Excel **Tables**
- Tables provide structured, queryable data
- Automatic schema validation
- Column name access (not just indexes)
- Better for programmatic access

### Why Workbook Sessions?
- Provides isolated edit context
- Prevents conflicts with concurrent users
- Recommended by Microsoft for write operations
- Ensures data consistency
- Required for batch operations

### Why Tailwind CSS?
- Utility-first speeds up development
- Highly customizable with CSS variables
- Built-in dark mode support
- Excellent performance (PurgeCSS)
- Industry standard

### Why shadcn/ui?
- Copy-paste approach (full control over code)
- Built on Radix UI (world-class accessibility)
- Highly customizable
- No package bloat (only includes used components)
- TypeScript-first

### Why MSAL Browser?
- Official Microsoft authentication library
- Handles token refresh automatically
- Supports SSO and silent acquisition
- Industry standard for Azure AD
- Built-in error recovery

## Common Issues & Solutions

### "Table not found" Error
- **Cause**: Data is in worksheet cells, not an Excel Table
- **Solution**: Select data → Insert → Table → Name it correctly (e.g., "RepairTable")
- **Verify**: Table appears in Excel's Table Design tab

### "EditModeAccessDenied" Error
- **Cause**: No edit permissions on Excel file
- **Solution**: Check SharePoint permissions, ensure you have Edit access
- **Fix**: File → Share → Grant Edit to your account

### "access_denied" on Login
- **Cause**: API permissions need admin consent
- **Solution**: Azure AD admin must grant consent in App Registration → API permissions → Grant admin consent

### Can't Log In / Popup Blocked
- **Cause**: Browser blocking popup window
- **Solution**: Allow popups for localhost or your domain
- **Alternative**: App automatically falls back to redirect flow

### Data Not Refreshing
- **Cause**: React Query cache not invalidating
- **Solution**: Click refresh button (top right) or wait for auto-refetch (30 seconds)
- **Force Refresh**: F5 (browser reload)

### AI Assistant Not Responding
- **Cause**: Invalid or missing Anthropic API key
- **Solution**: Verify `VITE_ANTHROPIC_API_KEY` in `.env.local`
- **Check**: API key starts with `sk-ant-api03-`

### Files Not Uploading
- **Cause**: SharePoint permissions or incorrect site ID
- **Solution**:
  - Check `VITE_STORAGE_TYPE` setting
  - Verify SharePoint site ID if using SharePoint storage
  - Ensure OneDrive access if using OneDrive storage

### NET Payment Reminders Not Creating
- **Cause**: Missing Calendar/Tasks API permissions
- **Solution**: Add `Calendars.ReadWrite` and `Tasks.ReadWrite` to Azure AD app

### Dark Mode Colors Wrong
- **Cause**: Theme variables not loaded
- **Solution**: Check `index.css` has `:root` and `.dark` CSS variables
- **Reset**: Clear browser cache, reload

## Future Enhancements

Potential features for future development:

### High Priority
- [ ] Global search across all 4 tables (Active, Paid, NET, Returns)
- [ ] Responsive mobile table layout
- [ ] Advanced PDF/CSV export with filtering
- [ ] Bulk email sending to multiple shops
- [ ] Email send history tracking
- [ ] RO edit history/audit log

### Medium Priority
- [ ] Power BI integration for advanced analytics
- [ ] Gantt chart view for repair timelines
- [ ] Cost trend analysis and forecasting
- [ ] Shop performance metrics and ratings
- [ ] Automated quote reminder escalation
- [ ] Push notifications for overdue ROs

### Low Priority
- [ ] Mobile app (React Native)
- [ ] Offline support with sync
- [ ] Power Automate workflow integration
- [ ] QR code generation for ROs
- [ ] Barcode scanning for parts
- [ ] Multi-language support

## Contributing

This is an internal GenThrust project. For questions or issues:
- Contact the development team
- Submit issues via internal ticketing system
- Request features via project management board

## License

**Proprietary - GenThrust XVII Internal Use Only**

All rights reserved. This software is the property of GenThrust XVII and may not be distributed, copied, or used outside the organization without explicit written permission.

---

## Quick Reference

### Keyboard Shortcuts
- **Ctrl+K** - Open AI Assistant
- **Esc** - Close dialogs
- **Ctrl+F** - Focus search (browser default)

### AI Assistant Examples
```
"Update RO 12345 to RECEIVED status"
"Show me all overdue ROs from Duncan Aviation"
"Send a reminder email to StandardAero for RO 12346"
"What's the summary for RO 12347?"
"Archive RO 12348 to PAID"
"Show high value ROs over $10000"
```

### Status Flow
```
TO SEND → WAITING QUOTE → APPROVED → BEING REPAIRED →
CURRENTLY BEING SHIPPED → RECEIVED → SHIPPING → PAID → PAYMENT SENT

Alternative endings:
→ BER (Beyond Economic Repair)
→ RAI (Return As Is)
```

### Archive Routing
- **PAID Sheet**: Received + non-NET payment terms
- **NET Sheet**: Received + NET30/60/90 terms (creates reminder)
- **Returns Sheet**: BER, RAI, Cancelled statuses

---

**Built with ❤️ using Claude Code & Claude AI for GenThrust XVII**

*Last Updated: January 2025*
