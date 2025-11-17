# CLAUDE.md - Project Knowledge Base for AI Assistant

## Purpose
This document serves as the **primary knowledge base** for Claude (AI assistant) to understand the GenThrust RO Tracker project. It provides a high-level overview, operating principles, and guides for navigating the codebase.

---

## Project Identity

**Name:** GenThrust RO Tracker
**Purpose:** Track aircraft parts sent to repair stations with AI-powered automation
**Type:** Full-stack web application with hybrid data architecture
**Owner:** GenThrust XVII
**Primary User:** Calvin Malagon (cmalagon@genthrust.net)

---

## Core Principles for Claude

### 1. Documentation-First Approach
- **ALWAYS** consult `.claude/` documentation before making assumptions
- When uncertain, read the appropriate doc file:
  - Architecture questions → `architecture.md`
  - Module details → `modules.md`
  - Business logic → `bll.md`
  - Data access → `dal.md`
  - UI components → `view.md`
  - Data structures → `data_models.md`
  - Workflows → `workflows.md`
  - Error handling → `error_handling.md`

### 2. Knowledge Management
- **Never rely solely on conversation context** - use retrieval
- When project changes, **suggest documentation updates**
- If documentation is missing or outdated, **inform the user**
- Maintain accuracy without filling conversation with excessive detail

### 3. Code Interaction Guidelines
- Read actual code files when you need specific implementation details
- Use Glob/Grep to search for patterns across the codebase
- Reference file paths with line numbers (e.g., `excelService.ts:45`)
- Never assume API signatures - verify them

### 4. Update Protocol
When the user makes significant changes:
1. Identify which documentation files are affected
2. Suggest specific updates to those files
3. Wait for user confirmation before updating
4. Update only the necessary sections

---

## Project Overview

### What Problem Does This Solve?
GenThrust manually tracked 98+ repair orders across 27 shops using Excel spreadsheets. This was tedious, error-prone, and hard to monitor. The RO Tracker automates this with:
- Real-time web interface
- Direct Excel integration (no migration needed)
- AI-powered natural language commands
- Automated reminders and workflows
- Shop directory and analytics

### Key Features
1. **Repair Order Management** - Track status, costs, dates across multiple sheets
2. **AI Assistant** - Natural language commands via Claude Sonnet 4
3. **Shop Directory** - Manage repair facilities and contacts
4. **Inventory Search** - MySQL-backed fast search across GenThrust inventory
5. **Smart Archiving** - Auto-route completed ROs to PAID, NET, or Returns sheets
6. **Email Integration** - Send emails directly to shops
7. **File Attachments** - Upload/manage documents per RO
8. **Analytics Dashboard** - KPIs, trends, overdue tracking

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│  React Frontend (Vite + TypeScript)                 │
│  ├─ UI Components (shadcn/ui)                       │
│  ├─ React Query (data fetching & caching)           │
│  ├─ MSAL (Microsoft authentication)                 │
│  └─ Services (Excel, Shop, AI, SharePoint)         │
└──────────────┬──────────────────────────────────────┘
               │
               ├──> Microsoft Graph API (SharePoint/Excel)
               ├──> Anthropic AI (Claude Sonnet 4)
               └──> Node.js Backend (Express)
                    └──> MySQL Database (Inventory Index)
```

### Data Storage Strategy (Hybrid)
1. **Repair Orders & Shops** → SharePoint Excel Tables
   - Why: Existing data, familiar to users, easy backup
   - Tables: RepairTable, Paid, NET, Returns, ShopsTable
2. **Inventory** → MySQL Database
   - Why: Fast search across 10,000+ parts
   - Tables: stock_room, bins_inventory, etc.
3. **AI Logs** → SharePoint/OneDrive Excel files
   - Why: Easy review, export, audit trail

---

## Tech Stack

### Frontend
- **React 19.1** + TypeScript 5.9
- **Vite 7** - build tool
- **Tailwind CSS** + shadcn/ui
- **TanStack Query** (React Query 5.90)
- **MSAL** (Microsoft authentication)
- **Anthropic SDK** (AI integration)

### Backend
- **Node.js** + Express
- **MySQL 2** (inventory database)
- **Winston** (logging)
- **CORS** middleware

### APIs & Services
- **Microsoft Graph API** - Excel, SharePoint, OneDrive, Outlook, To Do
- **Anthropic API** - Claude Sonnet 4
- **Azure AD** - Authentication

---

## Key Constraints & Rules

### Business Rules
1. **Status-based next update dates** - Each status has a follow-up period (businessRules.ts)
2. **Payment term detection** - NET 30/60/90 extracted via regex
3. **Archival routing** - RECEIVED + NET terms → NET sheet, others → PAID sheet
4. **Overdue highlighting** - Red if past nextDateToUpdate

### Technical Constraints
1. **Excel Table Requirement** - Must be Excel Tables, not just worksheets
2. **Session Management** - Use workbook sessions for write operations
3. **Token Refresh** - MSAL handles automatic token renewal
4. **Rate Limiting** - Graph API has throttling limits
5. **MySQL Indexing** - Inventory must be pre-indexed for fast search

### Naming Conventions
- **Components:** PascalCase (e.g., ROTable.tsx)
- **Hooks:** camelCase with "use" prefix (e.g., useROs.ts)
- **Services:** camelCase with "Service" suffix (e.g., excelService.ts)
- **Types:** PascalCase interfaces (e.g., RepairOrder)
- **Constants:** UPPER_SNAKE_CASE

---

## Directory Structure

```
Genthrust_Repairs/
├── .claude/                    # ← THIS DIRECTORY - Your knowledge base
│   ├── CLAUDE.md              # This file - Main guide
│   ├── architecture.md        # System architecture
│   ├── modules.md             # Module breakdown
│   ├── bll.md                 # Business logic layer
│   ├── dal.md                 # Data access layer
│   ├── view.md                # View/UI layer
│   ├── data_models.md         # Data structures
│   ├── workflows.md           # Key workflows
│   └── error_handling.md      # Error handling & recovery system
│
├── backend/                   # Node.js Express server
│   ├── server.js             # Entry point
│   ├── routes/               # API routes
│   │   ├── inventory.js      # Inventory search API
│   │   ├── ai.js             # AI proxy API
│   │   └── ai-logs.js        # Logging API
│   └── config/               # DB config
│
├── repair-dashboard/          # React frontend
│   ├── src/
│   │   ├── App.tsx           # Root component
│   │   ├── components/       # UI components
│   │   ├── hooks/            # React Query hooks
│   │   ├── lib/              # Core services
│   │   ├── services/         # External integrations
│   │   ├── config/           # Configuration
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utilities
│   └── public/
│
├── DATABASE_SETUP.md         # MySQL setup instructions
├── INSTRUCTIONS.md           # Original build guide
├── README.md                 # Public project README
└── .env.local               # Environment variables (gitignored)
```

---

## Common Tasks & Where to Look

### Task: "How do I update a repair order status?"
1. Read `workflows.md` → "Update RO Status Workflow"
2. Read `bll.md` → "Status Update Logic"
3. Read `excelService.ts` → `updateROStatus()` method

### Task: "How does the AI assistant work?"
1. Read `architecture.md` → "AI Integration"
2. Read `modules.md` → "AI Services Module"
3. Read `anthropicAgent.ts` and `aiTools.ts`

### Task: "How is inventory searched?"
1. Read `dal.md` → "Inventory Data Access"
2. Read `workflows.md` → "Inventory Search Workflow"
3. Read `backend/routes/inventory.js`

### Task: "How do we archive a repair order?"
1. Read `bll.md` → "Archival Logic"
2. Read `workflows.md` → "Archival Workflow"
3. Read `excelService.ts` → `moveROToArchive()`

---

## Environment Variables

Located in `/repair-dashboard/.env.local` and `/backend/.env`:

### Frontend (.env.local)
```env
VITE_CLIENT_ID=              # Azure AD Client ID
VITE_TENANT_ID=              # Azure AD Tenant ID
VITE_SHAREPOINT_SITE_URL=    # SharePoint site
VITE_EXCEL_FILE_NAME=        # Book.xlsx
VITE_EXCEL_TABLE_NAME=       # RepairTable
VITE_SHOPS_FILE_NAME=        # Shops.xlsx
VITE_SHOPS_TABLE_NAME=       # ShopsTable
VITE_ANTHROPIC_API_KEY=      # Claude AI key (optional - can use backend)
VITE_BACKEND_URL=            # http://localhost:3001 (for inventory/AI proxy)
VITE_STORAGE_TYPE=           # "sharepoint" or "onedrive"
```

### Backend (.env)
```env
PORT=3001
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=           # Claude AI key
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=genthrust_inventory
```

---

## Important Code Patterns

### 1. Excel Date Conversion
```typescript
// Excel stores dates as serial numbers (days since 1900-01-01)
const jsDate = new Date((excelSerial - 25569) * 86400 * 1000);
```

### 2. MSAL Token Acquisition
```typescript
// Always try silent first, fallback to popup, then redirect
const token = await msalInstance.acquireTokenSilent({...})
  .catch(() => msalInstance.acquireTokenPopup({...}))
  .catch(() => msalInstance.acquireTokenRedirect({...}));
```

### 3. React Query Mutations
```typescript
const updateStatus = useMutation({
  mutationFn: (data) => excelService.updateROStatus(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ros'] });
    toast.success('Updated');
  }
});
```

### 4. Winston Logging
```typescript
const logger = createLogger('ModuleName');
logger.info('Message', { contextData });
logger.error('Error occurred', error);
```

---

## Testing Strategy

### Unit Tests
- `*.test.ts` or `*.test.tsx` files
- Use Vitest + React Testing Library
- Located next to source files

### Test Coverage Areas
1. Business rules (businessRules.test.ts)
2. Excel session management (excelSession.test.ts)
3. Email templates (emailTemplates.test.ts)
4. React hooks (useROs.test.tsx, useShops.test.tsx)
5. UI components (ROTable.test.tsx, etc.)

### Running Tests
```bash
cd repair-dashboard
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

---

## Deployment

### Development
```bash
# Frontend
cd repair-dashboard
npm run dev  # http://localhost:5173

# Backend
cd backend
npm start    # http://localhost:3001
```

### Production
- **Frontend:** Azure Static Web Apps or Vercel
- **Backend:** Azure App Service or Docker container
- **Database:** Azure MySQL or self-hosted

---

## When to Update Documentation

### Update `.claude/CLAUDE.md` when:
- Project goals or identity changes
- New major feature is added
- Directory structure changes significantly

### Update `.claude/architecture.md` when:
- New external service/API is integrated
- Tech stack changes (new library, framework upgrade)
- Deployment strategy changes

### Update `.claude/modules.md` when:
- New module/service is created
- Module responsibilities shift
- Dependencies between modules change

### Update `.claude/bll.md` when:
- Business rules change (status logic, archival rules)
- Calculation methods change (next update date, overdue logic)
- Validation rules are added/modified

### Update `.claude/dal.md` when:
- Database schema changes
- New data sources added
- API integration patterns change

### Update `.claude/view.md` when:
- New major UI component is added
- Component structure is refactored
- UI/UX patterns change

### Update `.claude/data_models.md` when:
- TypeScript interfaces change
- New data structures are introduced
- Field meanings or validations change

### Update `.claude/workflows.md` when:
- User workflows change
- New automated processes are added
- Integration workflows are modified

---

## Quick Reference

### Find a Component
```bash
find repair-dashboard/src/components -name "*.tsx"
```

### Find a Service
```bash
ls repair-dashboard/src/lib/
ls repair-dashboard/src/services/
```

### Search for a Function
```bash
grep -r "functionName" repair-dashboard/src/
```

### Find Type Definitions
```bash
cat repair-dashboard/src/types/index.ts
```

---

## Communication Protocol

### When Claude Needs Information
1. Check `.claude/` docs first
2. If unclear, read the actual source file
3. If still unclear, ask user specific questions
4. Document answers for future reference

### When Claude Makes Changes
1. Explain what was changed and why
2. Reference specific files and line numbers
3. Suggest documentation updates if needed
4. Confirm changes were successful

### When Claude Encounters Errors
1. Read error message carefully
2. Check relevant documentation
3. Search codebase for similar patterns
4. If novel issue, ask user for context

---

## Remember
- **Retrieval over memory** - Don't try to remember everything
- **Docs are truth** - Code may drift, docs should be current
- **Ask before updating** - Never silently change documentation
- **Be specific** - Use file paths and line numbers
- **Stay current** - Suggest updates when things change

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
