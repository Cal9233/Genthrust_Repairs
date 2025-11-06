# PHASE 1: PROJECT SETUP (30 minutes)

## Step 1.1: Create Project

```bash
# Navigate to repair-dashboard directory
cd repair-dashboard

# Create Vite + React + TypeScript project
npm create vite@latest . -- --template react-ts

# Install dependencies
npm install

# Install required packages
npm install @tanstack/react-query
npm install @azure/msal-browser @azure/msal-react
npm install lucide-react
npm install date-fns
npm install clsx tailwind-merge

# Install Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## Step 1.2: Setup Tailwind CSS

Update `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Update `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --radius: 0.5rem;
  }
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    sans-serif;
}
```

---

## Step 1.3: Install shadcn/ui Components

```bash
# Install shadcn CLI
npx shadcn-ui@latest init

# When prompted:
# - Would you like to use TypeScript? Yes
# - Which style would you like to use? Default
# - Which color would you like to use as base color? Slate
# - Where is your global CSS file? src/index.css
# - Would you like to use CSS variables for colors? Yes
# - Where is your tailwind.config.js located? tailwind.config.js
# - Configure the import alias for components? @/components
# - Configure the import alias for utils? @/lib/utils

# Add required components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add label
```

---

## Step 1.4: Environment Setup

Create `.env.local`:

```env
# Azure AD Configuration
VITE_CLIENT_ID=your-azure-ad-client-id
VITE_TENANT_ID=your-azure-ad-tenant-id

# SharePoint Configuration
VITE_SHAREPOINT_SITE_URL=https://yourcompany.sharepoint.com/sites/yoursite
VITE_EXCEL_FILE_NAME=GEN_REPAIRS_LIST__RO_S_OUTSIDE__.xlsx
VITE_EXCEL_TABLE_NAME=Table1
```

Create `.env.example` (same structure, empty values):

```env
# Azure AD Configuration
VITE_CLIENT_ID=
VITE_TENANT_ID=

# SharePoint Configuration
VITE_SHAREPOINT_SITE_URL=
VITE_EXCEL_FILE_NAME=
VITE_EXCEL_TABLE_NAME=
```

---

## Step 1.5: Update vite.config.ts

Make sure your `vite.config.ts` includes path aliases:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## Checkpoint

At this point you should have:

- ✅ Vite + React + TypeScript project initialized
- ✅ All dependencies installed
- ✅ Tailwind CSS configured
- ✅ shadcn/ui components added
- ✅ Environment variables template created
- ✅ Path aliases configured

**Next:** [Phase 2: Microsoft Authentication](02-AUTH.md)
