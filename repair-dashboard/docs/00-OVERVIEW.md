# GENTHRUST RO TRACKER - PROJECT OVERVIEW

## PROJECT GOAL

Build a simple, personal web app for Calvin to track aircraft parts sent to repair stations. This is a **personal productivity tool** - not an enterprise system. Keep it simple and practical.

## CURRENT SITUATION

- Excel file on SharePoint with 98+ active ROs across 27 shops
- Manual tracking in Excel is tedious
- Hard to see what's overdue
- Need quick way to update statuses and track progress

## SOLUTION

Make daily RO tracking easier with a clean web interface that reads/writes directly to the existing Excel file.

---

## TECH STACK

### Frontend
- **Framework:** React 18 + Vite (fast dev server)
- **Language:** TypeScript (better autocomplete/errors)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (copy-paste components)
- **Data Fetching:** TanStack Query
- **Auth:** MSAL (Microsoft authentication)
- **Icons:** lucide-react

### Backend
- **Data Source:** Excel file on SharePoint (existing file)
- **API:** Microsoft Graph API (read/write Excel)
- **No database needed** - Excel is the database

### Deployment
- **Hosting:** Vercel or Azure Static Web Apps (both free)
- **Cost:** $0/month

---

## PROJECT STRUCTURE

```
repair-dashboard/
├── .env.local
├── .env.example
├── package.json
├── vite.config.js
├── tailwind.config.js
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── msalConfig.ts
│   │   └── excelService.ts
│   ├── hooks/
│   │   ├── useROs.ts
│   │   └── useShops.ts
│   ├── components/
│   │   ├── ui/            # shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   └── dialog.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ROTable.tsx
│   │   ├── RODetailDialog.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── QuickFilters.tsx
│   │   └── UpdateStatusDialog.tsx
│   └── types/
│       └── index.ts
└── public/
    └── genthrust-logo.svg
```

---

## IMPLEMENTATION PHASES

1. **Phase 1:** Project Setup (30 minutes)
2. **Phase 2:** Microsoft Authentication (1 hour)
3. **Phase 3:** Excel Service (2 hours)
4. **Phase 4:** React Hooks (30 minutes)
5. **Phase 5:** UI Components (3-4 hours)
6. **Phase 6:** Main App (30 minutes)
7. **Phase 7:** Azure AD Setup (20 minutes)
8. **Phase 8:** Deployment (30 minutes)

**Total estimated time:** 2-3 days (~11 hours)

---

## KEY FEATURES

- Dashboard with stats (active ROs, overdue, costs, etc.)
- Searchable and sortable table
- Detail view for each RO
- Quick status updates
- Automatic overdue highlighting
- Auto-refresh every minute
- Mobile responsive

---

## COST BREAKDOWN

- **Development**: DIY (your time)
- **Hosting**: $0 (Vercel free tier or Azure Static Web Apps)
- **Azure AD**: $0 (included in Microsoft 365)
- **SharePoint**: $0 (existing)
- **Total**: **$0/month**

---

## END RESULT

You'll have a clean, simple web app that:

✅ Loads your RO data from SharePoint Excel
✅ Shows what's overdue at a glance
✅ Let's you update statuses with a few clicks
✅ Auto-refreshes so you always see current data
✅ Works on your phone
✅ Costs nothing to run

**No complexity. Just a tool to make your day easier.**
