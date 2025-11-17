# architecture.md - System Architecture Documentation

## Purpose
This document describes the technical architecture of the GenThrust RO Tracker, including system design, tech stack, data flow, integration points, and deployment architecture.

---

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           User's Browser                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │             React SPA (Single Page Application)                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  Components Layer                                             │  │  │
│  │  │  - Dashboard, ROTable, ShopDirectory, AIAgentDialog           │  │  │
│  │  │  - RODetailDialog, UpdateStatusDialog, EmailComposer          │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  Hooks Layer (React Query)                                    │  │  │
│  │  │  - useROs, useShops, useAttachments, useInventorySearch       │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  Services Layer                                                │  │  │
│  │  │  - excelService, shopService, reminderService                 │  │  │
│  │  │  - sharePointService, loggingService, inventoryService        │  │  │
│  │  │  - anthropicAgent, aiTools                                    │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  Authentication (MSAL)                                         │  │  │
│  │  │  - Azure AD authentication, token management                  │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────────────┐
        │                  │                               │
        ▼                  ▼                               ▼
┌──────────────┐  ┌─────────────────┐         ┌──────────────────────┐
│ Azure AD     │  │ Microsoft Graph │         │ Node.js Backend      │
│ (Auth)       │  │ API              │         │ (Express)            │
└──────────────┘  │                 │         │                      │
                  │ - SharePoint    │         │ ┌──────────────────┐ │
                  │ - Excel         │         │ │ API Routes       │ │
                  │ - OneDrive      │         │ │ /api/inventory   │ │
                  │ - Outlook       │         │ │ /api/ai          │ │
                  │ - Microsoft To Do│        │ │ /api/ai-logs     │ │
                  │ - Calendar      │         │ └──────────────────┘ │
                  └─────────────────┘         │                      │
                           │                  │ ┌──────────────────┐ │
                           ▼                  │ │ MySQL Client     │ │
                  ┌─────────────────┐         │ └────────┬─────────┘ │
                  │ SharePoint      │         └──────────┼───────────┘
                  │ Online          │                    │
                  │                 │                    ▼
                  │ ┌─────────────┐ │         ┌──────────────────────┐
                  │ │ Book.xlsx   │ │         │ MySQL Database       │
                  │ │ - RepairTable│ │        │ genthrust_inventory  │
                  │ │ - Paid      │ │         │                      │
                  │ │ - NET       │ │         │ - stock_room         │
                  │ │ - Returns   │ │         │ - bins_inventory     │
                  │ └─────────────┘ │         │ - receiving          │
                  │                 │         │ - inventoryindex     │
                  │ ┌─────────────┐ │         │   (master index)     │
                  │ │ Shops.xlsx  │ │         └──────────────────────┘
                  │ │ - ShopsTable│ │
                  │ └─────────────┘ │                    │
                  │                 │                    ▼
                  │ ┌─────────────┐ │         ┌──────────────────────┐
                  │ │ Attachments │ │         │ Anthropic API        │
                  │ │ (folders)   │ │         │ Claude Sonnet 4      │
                  │ └─────────────┘ │         │                      │
                  └─────────────────┘         │ - Tool Use API       │
                                              │ - Streaming          │
                                              └──────────────────────┘
```

---

## Technology Stack

### Frontend Stack

#### Core Framework
- **React 19.1.0**
  - Latest React with concurrent features
  - Server Components ready (not yet used)
  - Automatic batching and transitions

#### Build Tool
- **Vite 7.0.2**
  - Lightning-fast HMR (Hot Module Replacement)
  - ESBuild-powered bundling
  - Optimized production builds
  - Plugin ecosystem

#### Language
- **TypeScript 5.9.2**
  - Type safety across codebase
  - Better IDE support and autocomplete
  - Catch errors at compile time
  - Interface-driven development

#### Styling
- **Tailwind CSS 3.4.16**
  - Utility-first CSS framework
  - JIT (Just-In-Time) compiler
  - Dark mode support
  - Custom design system via CSS variables

#### UI Component Library
- **shadcn/ui**
  - Copy-paste component approach
  - Built on Radix UI primitives
  - Fully customizable
  - Accessible by default (ARIA compliant)

- **Radix UI**
  - Headless UI primitives
  - Accessibility built-in
  - Composable components

#### Icons
- **Lucide React**
  - 550+ beautiful icons
  - Tree-shakeable
  - Consistent design language

#### State Management & Data Fetching
- **TanStack Query (React Query) 5.90.1**
  - Server state management
  - Automatic caching and background updates
  - Optimistic updates
  - Request deduplication
  - Automatic retries and error handling

#### Authentication
- **@azure/msal-browser 3.30.0**
  - Microsoft Authentication Library
  - Azure AD SSO support
  - Silent token acquisition
  - Popup and redirect flows
  - Automatic token refresh

- **@azure/msal-react 2.2.0**
  - React-specific MSAL hooks
  - Context providers
  - Protected route support

#### AI Integration
- **@anthropic-ai/sdk 0.38.1**
  - Official Anthropic SDK
  - Streaming support
  - Tool use (function calling)
  - TypeScript types included

#### Notifications
- **Sonner 1.7.4**
  - Beautiful toast notifications
  - Promise-based toasts
  - Customizable styling

#### Utilities
- **date-fns 4.1.0** - Date manipulation
- **class-variance-authority** - Variant management
- **tailwind-merge** - Intelligent Tailwind class merging
- **clsx** - Conditional class names

---

### Backend Stack

#### Runtime
- **Node.js** (v18+)
  - JavaScript runtime
  - Non-blocking I/O
  - NPM ecosystem

#### Framework
- **Express 4.21.2**
  - Minimal web framework
  - Middleware-based architecture
  - RESTful API routing

#### Database
- **MySQL2 3.12.0**
  - MySQL client for Node.js
  - Promise support
  - Connection pooling
  - Prepared statements

#### Middleware
- **cors 2.8.5** - Cross-Origin Resource Sharing
- **dotenv 16.4.7** - Environment variable management

#### Logging
- **Winston** (via repair-dashboard)
  - Structured logging
  - Multiple transports
  - Log levels (error, warn, info, debug)

---

### External Services & APIs

#### Microsoft Graph API
**Base URL:** `https://graph.microsoft.com/v1.0`

**Used For:**
1. **SharePoint/Excel Operations**
   - Read/write Excel tables
   - Create workbook sessions
   - Search for files
   - List workbook structure

2. **File Storage (OneDrive/SharePoint)**
   - Upload files
   - Download files
   - List files in folders
   - Delete files

3. **Email (Outlook)**
   - Send emails
   - Access mailbox (planned)

4. **Tasks (Microsoft To Do)**
   - Create task lists
   - Create tasks with due dates
   - Update task status

5. **Calendar (Outlook)**
   - Create calendar events
   - Set reminders for payment due dates

#### Anthropic API
**Base URL:** `https://api.anthropic.com/v1`

**Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

**Features Used:**
- **Streaming Responses** - Real-time AI output
- **Tool Use API** - Structured function calling
- **Context Management** - Conversation history
- **Max Tokens:** 8192 per response
- **Context Window:** 200K tokens

**Tools Implemented:**
1. `update_repair_order` - Update RO fields
2. `query_repair_orders` - Filter and search ROs
3. `send_reminder_email` - Email shops
4. `get_repair_order_summary` - Summarize RO details
5. `archive_repair_order` - Archive completed ROs

#### Azure AD
**Purpose:** Enterprise authentication and authorization

**Features:**
- Single Sign-On (SSO)
- Multi-Factor Authentication (MFA) support
- Role-Based Access Control (RBAC)
- Token-based authentication (JWT)

**Scopes Requested:**
- `User.Read` - User profile
- `Files.ReadWrite.All` - Excel file access
- `Sites.Read.All` - SharePoint access
- `Tasks.ReadWrite` - To Do tasks
- `Calendars.ReadWrite` - Calendar events

---

## Data Architecture

### Hybrid Data Strategy

The application uses a **hybrid data architecture** with different storage solutions optimized for different use cases:

```
┌────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                            │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  1. SharePoint Excel (Primary - Repair Orders & Shops)     │
│     ┌───────────────────────────────────────────────┐      │
│     │ Book.xlsx                                      │      │
│     │  - RepairTable (active ROs)                   │      │
│     │  - Paid (completed + paid)                    │      │
│     │  - NET (received + awaiting payment)          │      │
│     │  - Returns (BER, RAI, cancelled)              │      │
│     └───────────────────────────────────────────────┘      │
│     ┌───────────────────────────────────────────────┐      │
│     │ Shops.xlsx                                     │      │
│     │  - ShopsTable (repair facilities)             │      │
│     └───────────────────────────────────────────────┘      │
│                                                             │
│  2. MySQL Database (Inventory Index)                       │
│     ┌───────────────────────────────────────────────┐      │
│     │ genthrust_inventory                            │      │
│     │  - inventoryindex (master search index)       │      │
│     │  - stock_room                                  │      │
│     │  - bins_inventory                              │      │
│     │  - receiving                                   │      │
│     │  - other inventory tables                     │      │
│     └───────────────────────────────────────────────┘      │
│                                                             │
│  3. SharePoint/OneDrive (File Attachments)                 │
│     ┌───────────────────────────────────────────────┐      │
│     │ RO Attachments/                                │      │
│     │  - RO-12345/ (files for RO 12345)            │      │
│     │  - RO-12346/ (files for RO 12346)            │      │
│     └───────────────────────────────────────────────┘      │
│                                                             │
│  4. SharePoint/OneDrive (AI Logs)                          │
│     ┌───────────────────────────────────────────────┐      │
│     │ AI_Logs/                                       │      │
│     │  - AI_Log_2025-01-13.xlsx                     │      │
│     │  - AI_Log_2025-01-14.xlsx                     │      │
│     └───────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────┘
```

### Why This Hybrid Approach?

#### SharePoint Excel for Repair Orders & Shops
**Rationale:**
- Existing data already in Excel
- Users familiar with Excel
- Easy manual review and editing
- Built-in versioning and backup
- No data migration required
- Collaborative editing support

**Tradeoffs:**
- Slower than SQL database
- Limited to ~10,000 rows per table
- No complex joins
- Must use Graph API sessions for writes

#### MySQL for Inventory
**Rationale:**
- 10,000+ parts across multiple tables
- Fast full-text search required
- Complex queries (LIKE searches, joins)
- Pre-indexed for performance
- Scales better than Excel

**Tradeoffs:**
- Requires separate database server
- Additional maintenance overhead
- Need to keep index synchronized

#### SharePoint for File Attachments
**Rationale:**
- Native file storage integration
- Version history
- Access control
- Web-accessible URLs
- Organized by RO number

#### SharePoint/OneDrive for AI Logs
**Rationale:**
- Easy export to Excel
- User-friendly review
- Audit trail
- No database schema needed

---

## Data Flow Patterns

### 1. Read Repair Orders Flow

```
User clicks "Repairs" tab
  └─> useROs hook invoked
      └─> React Query checks cache
          ├─ Cache hit → Return cached data (instant)
          └─ Cache miss/stale → Fetch from server
              └─> excelService.getRepairOrders()
                  ├─> getAccessToken() (MSAL silent acquisition)
                  ├─> Get SharePoint site & drive
                  ├─> Search for Book.xlsx file
                  ├─> GET /workbook/tables/RepairTable/rows
                  ├─> Parse Excel data (dates, currency)
                  ├─> Calculate overdue status
                  └─> Return RepairOrder[]
                      └─> React Query caches result (5 min TTL)
                          └─> Component re-renders with data
```

### 2. Update RO Status Flow

```
User selects status + notes in UpdateStatusDialog
  └─> Click "Update Status"
      └─> useUpdateROStatus mutation
          └─> excelService.updateROStatus(rowIndex, status, notes)
              ├─> Create workbook session (isolated context)
              ├─> Get current row data
              ├─> Update fields:
              │   - currentStatus
              │   - currentStatusDate
              │   - notes (append or replace)
              │   - lastDateUpdated
              │   - nextDateToUpdate (calculated)
              │   - statusHistory (append new entry)
              ├─> PATCH /workbook/tables/RepairTable/rows/itemAt(index=X)
              ├─> Close workbook session
              └─> Success
                  ├─> React Query invalidates cache
                  ├─> Auto-refetch repair orders
                  ├─> Toast notification shown
                  └─> Update business logic fires:
                      └─> createNextUpdateReminder() (if configured)
```

### 3. AI Command Flow

```
User types "Update RO 12345 to RECEIVED" in AI Agent
  └─> AIAgentDialog sends message
      └─> anthropicAgent.processCommand(message, context)
          ├─> Build context:
          │   - Current RO data
          │   - Shop data
          │   - User preferences
          ├─> Call Anthropic API with tool schemas
          ├─> Stream response chunks:
          │   ├─> Text chunks → Display in real-time
          │   └─> Tool use detected:
          │       └─> Execute aiTools.update_repair_order(args)
          │           ├─> Validate RO number exists
          │           ├─> Call excelService.updateROStatus(...)
          │           ├─> Log interaction (loggingService)
          │           └─> Return result to AI
          ├─> AI generates final response with result
          └─> Display completion message
              └─> Cache invalidation triggers UI refresh
```

### 4. Inventory Search Flow

```
User types part number in Inventory Search
  └─> useInventorySearch hook (debounced 300ms)
      └─> fetch(BACKEND_URL + '/api/inventory/search?partNumber=XXX')
          └─> Backend /api/inventory/search route
              ├─> Step 1: Exact match in inventoryindex
              │   SELECT * FROM inventoryindex WHERE PartNumber = 'XXX'
              ├─> Step 2: LIKE search in inventoryindex
              │   SELECT * FROM inventoryindex WHERE PartNumber LIKE '%XXX%'
              └─> Step 3: Direct search in inventory tables
                  ├─> SELECT * FROM stock_room WHERE PN LIKE '%XXX%'
                  ├─> SELECT * FROM bins_inventory WHERE PN LIKE '%XXX%'
                  └─> Combine results
                      └─> Return JSON array
                          └─> Frontend displays results in table
```

---

## Security Architecture

### Authentication Flow (MSAL)

```
1. User visits app
   └─> Check if authenticated
       ├─ No → Show login screen
       │   └─> User clicks "Sign in with Microsoft"
       │       └─> MSAL initiates auth flow:
       │           ├─ Try Popup flow (default)
       │           └─ Fallback to Redirect flow if popup blocked
       │               └─> Redirect to login.microsoftonline.com
       │                   └─> User enters credentials
       │                       └─> MFA challenge (if enabled)
       │                           └─> Redirect back with auth code
       │                               └─> Exchange code for tokens:
       │                                   ├─ Access Token (1 hour)
       │                                   ├─ ID Token (user info)
       │                                   └─ Refresh Token (90 days)
       │                                       └─> Store in sessionStorage
       │                                           └─> App loads
       │
       └─ Yes → Load app
           └─> Silent token acquisition for API calls
               ├─> Check token expiration
               ├─ Valid → Use cached token
               └─ Expired → Refresh silently
                   └─> If refresh fails → Prompt re-login
```

### Authorization Model

**Access Levels:**
1. **Standard User** - All users
   - View/edit repair orders
   - View/edit shops
   - Search inventory
   - Use AI assistant
   - Upload attachments

2. **Advanced User** - `cmalagon@genthrust.net`
   - All standard permissions
   - Shop Analytics tab
   - Advanced reporting

**Microsoft Graph Permissions:**
- Delegated (user context)
- No application permissions (no unattended access)

### Data Security

**At Rest:**
- SharePoint files encrypted by Microsoft (AES-256)
- MySQL supports encryption (optional)
- Environment variables never committed to git

**In Transit:**
- All API calls over HTTPS
- TLS 1.2+ enforced
- Bearer token in Authorization header

**Token Security:**
- Tokens stored in sessionStorage (not localStorage)
- Automatic expiration (1 hour)
- httpOnly cookies not used (SPA architecture)

---

## Performance Optimizations

### Frontend Optimizations

1. **React Query Caching**
   - 5-minute stale time
   - Background refetching
   - Request deduplication
   - Optimistic updates

2. **Code Splitting**
   - Lazy load dialog components
   - Route-based splitting (if multi-page)
   - Vendor bundle separation

3. **Memoization**
   - `useMemo` for expensive calculations (filtering, sorting)
   - `useCallback` for stable function references
   - Component-level memoization (React.memo)

4. **Debouncing**
   - Search input (300ms debounce)
   - Filter changes
   - API calls

5. **Virtual Scrolling** (Planned)
   - For large RO tables (>1000 rows)
   - Render only visible rows

### Backend Optimizations

1. **MySQL Indexing**
   - Primary key on `IndexId`
   - Index on `PartNumber` (frequently queried)
   - Full-text index on `Description`

2. **Connection Pooling**
   - Reuse DB connections
   - Max 10 concurrent connections
   - Automatic reconnection

3. **Query Optimization**
   - Limit results (50 max)
   - Avoid SELECT * (specify columns)
   - Use prepared statements

### Graph API Optimizations

1. **Batch Requests** (Planned)
   - Combine multiple API calls
   - Reduce round trips

2. **Workbook Sessions**
   - Isolated edit context
   - Prevents conflicts
   - Auto-close in finally block

3. **Selective Column Fetches**
   - Only fetch needed columns
   - Reduce payload size

---

## Deployment Architecture

### Development Environment

```
Developer Machine
├─ Frontend: http://localhost:5173 (Vite dev server)
├─ Backend: http://localhost:3001 (Express)
└─ Database: localhost:3306 (MySQL local)
```

### Production Environment (Planned)

```
┌─────────────────────────────────────────────┐
│  Azure Static Web Apps / Vercel             │
│  (Frontend - React SPA)                     │
│  - CDN distribution                          │
│  - Automatic HTTPS                           │
│  - Custom domain support                     │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Azure App Service / Docker Container       │
│  (Backend - Node.js API)                    │
│  - Auto-scaling                              │
│  - Load balancing                            │
│  - Health checks                             │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  Azure Database for MySQL / Self-hosted     │
│  (Inventory Database)                       │
│  - Automated backups                         │
│  - Point-in-time restore                     │
│  - High availability                         │
└─────────────────────────────────────────────┘
```

### Environment Configuration

**Frontend Build:**
```bash
cd repair-dashboard
npm run build
# Output: /dist folder (static files)
# Deploy to Azure Static Web Apps or Vercel
```

**Backend Deployment:**
```bash
cd backend
# Option 1: Direct deployment
npm start

# Option 2: Docker
docker build -t genthrust-backend .
docker run -p 3001:3001 genthrust-backend
```

---

## Scalability Considerations

### Current Limits
- **Repair Orders:** ~1,000 active (Excel table limit: ~10,000)
- **Shops:** ~100-200 (Excel table)
- **Inventory:** 10,000+ parts (MySQL scales well)
- **Concurrent Users:** 5-10 (Graph API rate limits)

### Future Scaling Options
1. **Move ROs to SQL Database**
   - When Excel limits are reached
   - Better query performance
   - Complex reporting

2. **Implement Caching Layer**
   - Redis for frequently accessed data
   - Reduce Graph API calls

3. **Add Background Jobs**
   - Scheduled sync tasks
   - Email queue processing
   - Report generation

---

## Monitoring & Observability

### Current Logging
- **Winston Logs** - Structured application logs
- **Console Logs** - Development debugging
- **AI Logs** - Interaction audit trail (Excel files)

### Planned Monitoring
- **Application Insights** (Azure)
  - Error tracking
  - Performance metrics
  - User analytics

- **Health Checks**
  - `/health` endpoint (backend)
  - Database connection status
  - API availability

---

## Disaster Recovery

### Backup Strategy
1. **SharePoint Excel Files**
   - Automatic versioning (SharePoint)
   - Manual backups (download .xlsx)
   - 30-day retention

2. **MySQL Database**
   - Daily automated backups (planned)
   - Point-in-time recovery
   - Export scripts

3. **Code Repository**
   - Git version control
   - GitHub remote backup
   - Branch protection

### Recovery Procedures
- **Excel file corruption:** Restore from SharePoint version history
- **Database failure:** Restore from latest backup, replay transactions
- **Service outage:** Redeploy from git repository

---

## Technology Decision Log

### Why React over Angular/Vue?
- Largest ecosystem
- Best TypeScript support
- Most job market demand
- Best UI library (shadcn/ui)

### Why Vite over Create React App?
- 10x faster dev server
- Better build performance
- Modern tooling (ESBuild)
- CRA is deprecated

### Why SharePoint Excel over SQL?
- Data already exists in Excel
- Users comfortable with Excel
- No migration needed
- Easy backup and review

### Why MySQL over PostgreSQL?
- Simpler setup
- Good performance for read-heavy workload
- Adequate for inventory search use case

### Why Claude over GPT?
- Better at structured tasks
- Tool use API (function calling)
- Streaming responses
- 200K context window

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
