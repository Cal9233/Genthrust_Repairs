# GenThrust RO Tracker

A simple, personal web app to track aircraft parts sent to repair stations.

## Quick Start

1. Read [Project Overview](docs/00-OVERVIEW.md)
2. Follow [Setup Guide](docs/01-SETUP.md)
3. Work through each phase in order

## Documentation

### Setup & Implementation
- [00 - Project Overview](docs/00-OVERVIEW.md)
- [01 - Project Setup](docs/01-SETUP.md) - 30 minutes
- [02 - Microsoft Authentication](docs/02-AUTH.md) - 1 hour
- [03 - Excel Service](docs/03-EXCEL-SERVICE.md) - 2 hours
- [04 - React Hooks](docs/04-REACT-HOOKS.md) - 30 minutes
- [05 - UI Components](docs/05-UI-COMPONENTS.md) - 3-4 hours
- [06 - Main App](docs/06-MAIN-APP.md) - 30 minutes
- [07 - Azure AD Setup](docs/07-AZURE-SETUP.md) - 20 minutes
- [08 - Deployment](docs/08-DEPLOYMENT.md) - 30 minutes

### Reference
- [99 - Testing & Troubleshooting](docs/99-TESTING-TROUBLESHOOTING.md)

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth:** MSAL (Microsoft)
- **Data:** Microsoft Graph API → SharePoint Excel
- **Deployment:** Vercel (free)

## Features

- Dashboard with real-time stats
- Searchable and sortable RO table
- Overdue item highlighting
- Quick status updates
- Auto-refresh every minute
- Mobile responsive
- Zero monthly cost

## Project Structure

```
repair-dashboard/
├── docs/              # Implementation guides
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Services and utilities
│   └── types/         # TypeScript types
├── .env.local         # Environment variables (create this)
└── package.json
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create `.env.local`:

```env
VITE_CLIENT_ID=your-azure-ad-client-id
VITE_TENANT_ID=your-azure-ad-tenant-id
VITE_SHAREPOINT_SITE_URL=https://yourcompany.sharepoint.com/sites/yoursite
VITE_EXCEL_FILE_NAME=your-excel-file.xlsx
VITE_EXCEL_TABLE_NAME=Table1
```

## Timeline

- **Day 1:** Setup, auth, Excel service (4 hours)
- **Day 2:** Build UI components (4 hours)
- **Day 3:** Polish, testing, deploy (3 hours)

**Total:** ~11 hours over 2-3 days

## Support

See [Testing & Troubleshooting](docs/99-TESTING-TROUBLESHOOTING.md) for common issues.

## License

Personal use for GenThrust aircraft repair tracking.
