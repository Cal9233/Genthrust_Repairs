# Environment Separation Analysis & Implementation Plan
**Date:** 2025-11-24
**Status:** Analysis Complete - Awaiting User Decisions
**Priority:** CRITICAL - Production credentials exposed, local dev broken

---

## Table of Contents
1. [Current Context](#current-context)
2. [Critical Issues Identified](#critical-issues-identified)
3. [Complete Analysis Summary](#complete-analysis-summary)
4. [Proposed Solution](#proposed-solution)
5. [Implementation Plan](#implementation-plan)
6. [Questions for User](#questions-for-user)
7. [Files to Modify](#files-to-modify)
8. [Next Steps](#next-steps)

---

## Current Context

### What We Just Completed (v2.3.0)
Successfully implemented **Advanced Filter System** with:
- Multi-select shop exclusion filter
- Multi-select status inclusion filter
- localStorage persistence
- Tooltip component with Radix UI
- Comprehensive validation (38 checks passed)
- All code committed and pushed to main branch

### Current Problem
User wants to work on new features locally without interfering with production, but discovered:
- Some values are hard-coded for Netlify
- Local development doesn't work properly
- Risk of accidentally modifying production data

---

## Critical Issues Identified

### 🚨 SECURITY CRITICAL

#### Issue 1: Production Credentials Exposed in Git
**File:** `backend/.env` (tracked in git)

**Exposed Secrets:**
```env
DB_PASSWORD=AVNS_[REDACTED]  # Aiven MySQL password
ANTHROPIC_API_KEY=sk-ant-api03-[REDACTED]  # Claude API key
```

**Risk Level:** HIGH - Credentials accessible in git history
**Action Required:** Remove from git, rotate keys

---

### ⚠️ FUNCTIONALITY CRITICAL

#### Issue 2: Hard-Coded Netlify Function Paths

**File 1:** `repair-dashboard/src/config/anthropic.ts` (Line 7-9)
```typescript
// HARD-CODED - BREAKS LOCAL DEV
backendUrl: '/.netlify/functions/api'
```
**Impact:** AI Assistant cannot connect to local backend

---

**File 2:** `repair-dashboard/src/services/mysqlInventoryService.ts` (Line 12-14)
```typescript
// HARD-CODED - BREAKS LOCAL DEV
const API_BASE_URL = '/.netlify/functions/api';
```
**Impact:** Inventory search, low stock monitoring, inventory decrement fail locally

---

**File 3:** `repair-dashboard/src/services/repairOrderService.ts` (Line 11-13)
```typescript
// HARD-CODED - BREAKS LOCAL DEV
const API_BASE_URL = '/.netlify/functions/api';
```
**Impact:** MySQL-based RO CRUD operations fail locally

---

#### Issue 3: Backend Points to Production Database

**File:** `backend/.env`
```env
DB_HOST=genthrust-inventory-genthrust2017.b.aivencloud.com  # PRODUCTION!
NODE_ENV=production  # Should be "development" for local
```

**Risk:** Local development operations modify production data
**Impact:** Could corrupt live inventory, repair orders, or transactions

---

#### Issue 4: Shared SharePoint Files

**Current Setup:**
```
Dev Environment: Uses production SharePoint site
Prod Environment: Uses production SharePoint site
Result: Same Excel files for both environments
```

**Risk:** Local testing modifies production repair orders
**Impact:**
- Test data appears in production
- Status updates during dev affect live ROs
- Archival operations move real repair orders

---

#### Issue 5: Environment Variables Exist But Aren't Used

**Current `.env.local`:**
```env
VITE_BACKEND_URL=http://localhost:3001  # DEFINED BUT IGNORED!
VITE_API_BASE_URL=http://localhost:3001  # DEFINED BUT IGNORED!
```

**Problem:** Services use hard-coded values instead of reading these variables

---

## Complete Analysis Summary

### Current Architecture

#### Local Development (BROKEN):
```
Frontend (localhost:5173)
    ↓ Tries to call: /.netlify/functions/api ❌ (doesn't exist locally)
Backend Express Server (localhost:3001) ✅ (running but unreachable)
    ↓ Connects to: Production DB ⚠️ (should be local DB)
Aiven Cloud MySQL (Production)
```

#### Production (WORKING):
```
Frontend (Netlify CDN)
    ↓ Calls: /.netlify/functions/api ✅
Netlify Functions (Serverless)
    ↓ Connects to: Production DB ✅
Aiven Cloud MySQL (Production)
```

---

### What Should Be

#### Local Development (FIXED):
```
Frontend (localhost:5173)
    ↓ Calls: http://localhost:3001/api ✅ (from env var)
Backend Express Server (localhost:3001) ✅
    ↓ Connects to: Local MySQL ✅
MySQL (localhost:3306)
    └─ Database: genthrust_inventory_dev
```

#### Production (NO CHANGES):
```
Frontend (Netlify CDN)
    ↓ Calls: /.netlify/functions/api ✅ (from env var)
Netlify Functions (Serverless)
    ↓ Connects to: Production DB ✅
Aiven Cloud MySQL (Production)
```

---

## Proposed Solution

### Core Strategy
**Replace all hard-coded values with environment-based configuration**

### Key Components

#### 1. Centralized Environment Configuration Module
**New File:** `repair-dashboard/src/config/environment.ts`

**Purpose:**
- Single source of truth for environment detection
- Provides `getBackendUrl()` function that returns correct URL based on environment
- Validates required environment variables on startup
- Logs configuration in development mode

**Key Functions:**
```typescript
export const ENV = {
  MODE: import.meta.env.MODE, // 'development' or 'production'
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
};

export function getBackendUrl(): string {
  const url = import.meta.env.VITE_BACKEND_URL;

  if (!url) {
    // Fallback logic
    return ENV.IS_DEV
      ? 'http://localhost:3001/api'
      : '/.netlify/functions/api';
  }

  return url;
}

export function validateEnvironment(): { valid: boolean; errors: string[] } {
  // Validates all required environment variables
}
```

---

#### 2. Update Hard-Coded Services

**Changes Required:**

**File:** `repair-dashboard/src/config/anthropic.ts`
```typescript
// BEFORE:
backendUrl: '/.netlify/functions/api'

// AFTER:
import { getBackendUrl } from './environment';
backendUrl: getBackendUrl()
```

**File:** `repair-dashboard/src/services/mysqlInventoryService.ts`
```typescript
// BEFORE:
const API_BASE_URL = '/.netlify/functions/api';

// AFTER:
import { getBackendUrl } from '@/config/environment';
const API_BASE_URL = getBackendUrl();
```

**File:** `repair-dashboard/src/services/repairOrderService.ts`
```typescript
// BEFORE:
const API_BASE_URL = '/.netlify/functions/api';

// AFTER:
import { getBackendUrl } from '@/config/environment';
const API_BASE_URL = getBackendUrl();
```

---

#### 3. Proper .env File Structure

**Frontend:**
```
repair-dashboard/
├── .env.local              # Local dev (gitignored) ✅
├── .env.production         # Production (gitignored) ✅
├── .env.example            # Template ✅
└── .gitignore              # Ignore .env* files ✅
```

**Backend:**
```
backend/
├── .env.local              # Local dev (gitignored) ⚠️ NEEDS TO BE CREATED
├── .env.production         # Production (gitignored) ⚠️ NEEDS TO BE CREATED
├── .env.example            # Template ✅
└── .gitignore              # Ignore .env* files ⚠️ NEEDS UPDATE
```

---

#### 4. Environment Variable Definitions

**Frontend `.env.local` (Local Development):**
```env
# Backend API
VITE_BACKEND_URL=http://localhost:3001/api

# Azure AD
VITE_CLIENT_ID=ee8cb926-5dda-4bbf-9360-dd94d7c433e1
VITE_TENANT_ID=ddb0202c-cb5f-425e-891a-5666e58d9ad5

# SharePoint (OPTION 1: Separate dev site - RECOMMENDED)
VITE_SHAREPOINT_SITE_URL=https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite-Dev
VITE_EXCEL_FILE_NAME=RepairsDashboard_DEV.xlsx
VITE_SHOP_FILE_NAME=shops_DEV.xlsx

# SharePoint (OPTION 2: Production site - RISKY but quick)
# VITE_SHAREPOINT_SITE_URL=https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite
# VITE_EXCEL_FILE_NAME=RepairsDashboard.xlsx
# VITE_SHOP_FILE_NAME=shops.xlsx

VITE_EXCEL_TABLE_NAME=Repairs
VITE_SHOP_TABLE_NAME=AllShops
VITE_INVENTORY_WORKBOOK_ID=01TQZ4V7TFXKZ6Y3M354K2A6L3Y5K2K3E5F
VITE_STORAGE_TYPE=sharepoint
```

**Frontend `.env.production` (Production - Netlify):**
```env
# Backend API (relative path for same domain)
VITE_BACKEND_URL=/.netlify/functions/api

# Azure AD
VITE_CLIENT_ID=ee8cb926-5dda-4bbf-9360-dd94d7c433e1
VITE_TENANT_ID=ddb0202c-cb5f-425e-891a-5666e58d9ad5

# SharePoint (Production)
VITE_SHAREPOINT_SITE_URL=https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite
VITE_EXCEL_FILE_NAME=RepairsDashboard.xlsx
VITE_EXCEL_TABLE_NAME=Repairs
VITE_SHOP_FILE_NAME=shops.xlsx
VITE_SHOP_TABLE_NAME=AllShops
VITE_INVENTORY_WORKBOOK_ID=01TQZ4V7TFXKZ6Y3M354K2A6L3Y5K2K3E5F
VITE_STORAGE_TYPE=sharepoint
```

**Backend `.env.local` (Local Development - NEEDS TO BE CREATED):**
```env
# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (LOCAL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME_PROD=genthrust_inventory_dev
DB_NAME_DEV=genthrust_inventory_dev
DB_NAME_INVENTORY=genthrust_inventory_dev
# No SSL for local

# API Keys
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Backend `.env.production` (Production - NEEDS TO BE CREATED):**
```env
# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://genthrust-repairs.netlify.app

# Database (PRODUCTION - Aiven)
DB_HOST=genthrust-inventory-genthrust2017.b.aivencloud.com
DB_PORT=12076
DB_USER=avnadmin
DB_PASSWORD=AVNS_[REDACTED]
DB_NAME_PROD=defaultdb
DB_NAME_DEV=defaultdb
DB_NAME_INVENTORY=defaultdb
DB_SSL_CA=./ca.pem

# API Keys
ANTHROPIC_API_KEY=sk-ant-api03-[REDACTED]
```

---

#### 5. Database Separation Strategy

**Current (BROKEN):**
```
Local Dev → Production DB (risky!)
Production → Production DB
```

**Proposed:**
```
Local Dev → Local MySQL (localhost:3306/genthrust_inventory_dev)
Production → Aiven Cloud MySQL (production DB)
```

**Setup Required:**
1. Install MySQL locally (or use Docker)
2. Create database: `genthrust_inventory_dev`
3. Copy schema from production
4. Seed with test/sample data
5. Update `backend/.env.local` to use local DB

---

#### 6. SharePoint Separation Strategy

**Option 1: Separate Dev SharePoint Site (RECOMMENDED)**
```
Dev Site: PartsQuotationsWebsite-Dev
  Files: RepairsDashboard_DEV.xlsx, shops_DEV.xlsx
  Data: Test/sample data

Prod Site: PartsQuotationsWebsite
  Files: RepairsDashboard.xlsx, shops.xlsx
  Data: Live production data
```

**Benefits:**
- Complete isolation
- Safe testing
- Can reset dev data anytime
- No risk to production

**Requirements:**
- SharePoint admin access to create site
- Copy Excel files to new site
- Create Azure AD app registration for dev (optional)

---

**Option 2: Separate Files in Same Site**
```
Same Site: PartsQuotationsWebsite
  Dev Files: RepairsDashboard_DEV.xlsx, shops_DEV.xlsx
  Prod Files: RepairsDashboard.xlsx, shops.xlsx
```

**Benefits:**
- Easier setup (no new site needed)
- Same Azure AD app works

**Drawbacks:**
- Less isolation
- More error-prone (could open wrong file)

---

**Option 3: Read-Only Dev Mode (QUICK FIX)**
```
Development:
  - Read from production files (safe)
  - Write operations disabled or go to dev files
  - Warning banner in UI
```

**Benefits:**
- Fastest to implement
- Can start developing immediately

**Drawbacks:**
- Can't fully test write operations
- Still some risk

---

## Implementation Plan

### Phase 1: Immediate Fixes (CRITICAL) ⚠️
**Time Estimate:** 1 hour
**Priority:** Must do ASAP

#### Step 1: Secure Backend Credentials (10 min)
```bash
cd backend

# 1. Remove .env from git tracking
git rm --cached .env

# 2. Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore

# 3. Create .env.local for local dev
cp .env .env.local
# Edit to use local MySQL

# 4. Create .env.production backup
cp .env .env.production

# 5. Delete original .env (now tracked separately)
rm .env

# 6. Commit changes
git add .gitignore
git commit -m "chore: remove production credentials from git"
git push
```

**Critical:** After this, rotate API keys!

---

#### Step 2: Create Environment Config Module (15 min)
```bash
cd repair-dashboard/src/config

# Create new file: environment.ts
# Copy complete implementation from analysis
```

**File:** `environment.ts` (see full implementation in Proposed Solution section)

---

#### Step 3: Update Hard-Coded Services (20 min)

**Update 3 files:**
1. `config/anthropic.ts`
2. `services/mysqlInventoryService.ts`
3. `services/repairOrderService.ts`

Replace hard-coded `/.netlify/functions/api` with `getBackendUrl()` import.

---

#### Step 4: Create Proper .env Files (15 min)

**Frontend:**
```bash
cd repair-dashboard

# Already exists (update if needed)
# .env.local - for local dev

# Create production file
cat > .env.production << 'EOF'
VITE_BACKEND_URL=/.netlify/functions/api
# ... (see full content in Proposed Solution)
EOF

# Update .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

**Backend:**
```bash
cd backend

# Create local dev file (modify existing .env)
mv .env .env.local
# Edit to use localhost MySQL

# Create production file
cat > .env.production << 'EOF'
NODE_ENV=production
DB_HOST=genthrust-inventory-genthrust2017.b.aivencloud.com
# ... (see full content in Proposed Solution)
EOF

# Update .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

---

#### Step 5: Test Local Development (10 min)
```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Start frontend
cd repair-dashboard
npm run dev

# Browser: Open http://localhost:5173
# Test: AI Assistant (Ctrl+K)
# Test: Inventory Search
# Check: Browser console for errors
```

**Expected Result:** AI Assistant and Inventory Search should work locally!

---

### Phase 2: Database Isolation (HIGH PRIORITY)
**Time Estimate:** 30 minutes
**Priority:** High (prevents data corruption)

#### Step 6: Setup Local Development Database

**Option A: Local MySQL Installation**
```bash
# If MySQL installed
mysql -u root -p

CREATE DATABASE genthrust_inventory_dev;
USE genthrust_inventory_dev;

# Copy schema (export from production, import here)
# Seed with test data
```

**Option B: Docker MySQL**
```bash
# Create docker-compose.yml
docker-compose up -d mysql

# Connect and create database
docker exec -it mysql mysql -u root -p
CREATE DATABASE genthrust_inventory_dev;
```

**Update backend/.env.local:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME_DEV=genthrust_inventory_dev
NODE_ENV=development
```

---

### Phase 3: SharePoint Isolation (RECOMMENDED)
**Time Estimate:** 45 minutes
**Priority:** Recommended (prevents production data corruption)

#### Step 7: Create Development SharePoint Site

**Manual Steps:**
1. Go to SharePoint Admin Center
2. Create new site: "PartsQuotationsWebsite-Dev"
3. Copy RepairsDashboard.xlsx → rename to RepairsDashboard_DEV.xlsx
4. Copy shops.xlsx → rename to shops_DEV.xlsx
5. Populate with test data (10-20 sample ROs)

**Update `.env.local`:**
```env
VITE_SHAREPOINT_SITE_URL=https://genthrustxvii.sharepoint.com/sites/PartsQuotationsWebsite-Dev
VITE_EXCEL_FILE_NAME=RepairsDashboard_DEV.xlsx
VITE_SHOP_FILE_NAME=shops_DEV.xlsx
```

---

### Phase 4: Documentation & Polish (OPTIONAL)
**Time Estimate:** 30 minutes
**Priority:** Medium

#### Step 8: Update Documentation
- Update README.md with new environment setup
- Update DEPLOYMENT_GUIDE.md
- Create CONTRIBUTING.md for developers
- Add environment validation to app startup

---

## Questions for User

Before proceeding, need clarification on:

### 1. Database Strategy
**Question:** Do you have MySQL installed locally, or should we use Docker?

**Options:**
- A) I have MySQL installed (can create database immediately)
- B) Use Docker for MySQL (need to install Docker first)
- C) Keep using production database for now (risky, will fix later)

---

### 2. SharePoint Strategy
**Question:** Should we create a separate development SharePoint site?

**Options:**
- A) Create separate dev site (safest, requires admin access)
- B) Use separate files in same site (easier, less isolated)
- C) Keep using production files for now (risky, read-only mode possible)

---

### 3. Implementation Priority
**Question:** Which phase should we start with?

**Options:**
- A) Phase 1 only - Immediate fixes (~1 hour)
- B) Phase 1 + 2 - Fixes + database (~1.5 hours)
- C) Complete implementation - All phases (~3 hours)

---

### 4. API Key Rotation
**Question:** Should I help rotate the exposed API keys?

**Options:**
- A) Yes, guide me through rotating keys now
- B) I'll rotate manually later (just remove from git)

**Keys that need rotation:**
- Anthropic API key
- MySQL database password (or create new user)

---

## Files to Modify

### Phase 1 (Immediate - CRITICAL)

**Create:**
- [ ] `repair-dashboard/src/config/environment.ts` (new file)
- [ ] `repair-dashboard/.env.production` (new file)
- [ ] `backend/.env.local` (create from existing .env)
- [ ] `backend/.env.production` (create from existing .env)

**Modify:**
- [ ] `repair-dashboard/src/config/anthropic.ts` (1 line change)
- [ ] `repair-dashboard/src/services/mysqlInventoryService.ts` (2 lines)
- [ ] `repair-dashboard/src/services/repairOrderService.ts` (2 lines)
- [ ] `backend/.gitignore` (add .env patterns)
- [ ] `repair-dashboard/.gitignore` (verify .env patterns exist)

**Delete:**
- [ ] `backend/.env` (remove from git, keep as .env.local and .env.production)

**Git Actions:**
- [ ] `git rm --cached backend/.env`
- [ ] Commit changes
- [ ] Push to remove credentials from git

---

### Phase 2 (Database Isolation)

**Create:**
- [ ] Local MySQL database: `genthrust_inventory_dev`
- [ ] `backend/setup-local-db.sql` (schema + seed script)

**Modify:**
- [ ] `backend/.env.local` (point to local database)

---

### Phase 3 (SharePoint Isolation)

**Create:**
- [ ] New SharePoint site (or new Excel files)
- [ ] Dev Excel files with test data

**Modify:**
- [ ] `repair-dashboard/.env.local` (point to dev SharePoint)

---

## Next Steps

### When Ready to Resume:

1. **Review this document** to understand current state
2. **Answer the 4 questions** above
3. **Choose implementation priority** (Phase 1 minimum recommended)
4. **Begin implementation** following the step-by-step plan

### Immediate Actions Needed:

**CRITICAL (Do First):**
- [ ] Remove `backend/.env` from git
- [ ] Create proper `.env.local` and `.env.production` files
- [ ] Fix hard-coded Netlify URLs in 3 service files
- [ ] Test local development works

**HIGH PRIORITY (Do Soon):**
- [ ] Setup local MySQL database
- [ ] Rotate exposed API keys
- [ ] Create separate SharePoint site/files for dev

**MEDIUM PRIORITY (Do Eventually):**
- [ ] Update documentation
- [ ] Add environment validation
- [ ] Setup CI/CD with proper environment handling

---

## Testing Checklist

After implementation, verify:

### Local Development:
- [ ] Frontend starts on localhost:5173
- [ ] Backend starts on localhost:3001
- [ ] AI Assistant connects (Ctrl+K works)
- [ ] Inventory search works
- [ ] Database queries go to local MySQL (not production)
- [ ] SharePoint operations go to dev site/files (not production)
- [ ] No console errors

### Production Build:
- [ ] `npm run build` succeeds
- [ ] Build uses .env.production values
- [ ] Deployed to Netlify successfully
- [ ] AI Assistant works in production
- [ ] Inventory search works in production
- [ ] Database queries go to production MySQL
- [ ] SharePoint operations go to production files

---

## Additional Resources

### Documentation References:
- `.claude/architecture.md` - System architecture
- `.claude/backend_workflow.md` - Backend deployment workflow
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `DATABASE_SETUP.md` - MySQL setup guide

### Environment Variable Documentation:
- Vite: https://vitejs.dev/guide/env-and-mode.html
- Netlify: https://docs.netlify.com/environment-variables/overview/

---

## Current Git Status

**Branch:** main
**Last Commit:** `01e0ef3` - docs: Add v2.3.0 Advanced Filter System to changelog
**Uncommitted Changes:** None (working tree clean)

**Recent Features:**
- v2.3.0 - Advanced Filter System (just completed)
- v2.2.0 - Microsoft 365 Reminder Integration
- v2.1.0 - Enhanced Global Search
- v2.0.0 - Netlify Functions Migration

---

## Contact & Support

**Project:** GenThrust RO Tracker
**Owner:** Calvin Malagon (cmalagon@genthrust.net)
**Repository:** https://github.com/Cal9233/Genthrust_Repairs

---

**End of Document**

**Last Updated:** 2025-11-24
**Document Version:** 1.0
**Status:** Ready for Implementation - Awaiting User Decisions