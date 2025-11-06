# GENTHRUST RO TRACKER - CLAUDE CODE INSTRUCTIONS

## PROJECT OVERVIEW

Build a simple, personal web app for Calvin to track aircraft parts sent to repair stations. This is a **personal productivity tool** - not an enterprise system. Keep it simple and practical.

**Current Situation:**

- Excel file on SharePoint with 98+ active ROs across 27 shops
- Manual tracking in Excel is tedious
- Hard to see what's overdue
- Need quick way to update statuses and track progress

**Goal:**
Make daily RO tracking easier with a clean web interface that reads/writes directly to the existing Excel file.

---

## TECH STACK (Simple & Fast)

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
genthrust-ro-tracker/
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

## STEP-BY-STEP IMPLEMENTATION

### PHASE 1: PROJECT SETUP (30 minutes)

#### Step 1.1: Create Project

```bash
# Create Vite + React + TypeScript project
npm create vite@latest genthrust-ro-tracker -- --template react-ts

cd genthrust-ro-tracker

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

#### Step 1.2: Setup Tailwind CSS

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

#### Step 1.3: Install shadcn/ui Components

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
```

#### Step 1.4: Environment Setup

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

Create `.env.example` (same structure, empty values)

---

### PHASE 2: MICROSOFT AUTHENTICATION (1 hour)

#### Step 2.1: Create MSAL Config

Create `src/lib/msalConfig.ts`:

```typescript
import { Configuration, PopupRequest } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${
      import.meta.env.VITE_TENANT_ID
    }`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest: PopupRequest = {
  scopes: ["User.Read", "Files.ReadWrite", "Sites.Read.All"],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};
```

#### Step 2.2: Setup MSAL in Main App

Update `src/main.tsx`:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { msalConfig } from "./lib/msalConfig";
import App from "./App";
import "./index.css";

const msalInstance = new PublicClientApplication(msalConfig);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: 60 * 1000, // Auto-refresh every minute
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MsalProvider>
  </React.StrictMode>
);
```

---

### PHASE 3: EXCEL SERVICE (2 hours)

#### Step 3.1: Create Types

Create `src/types/index.ts`:

```typescript
export interface RepairOrder {
  id: string; // Generated from row index
  roNumber: string;
  dateMade: Date | null;
  shopName: string;
  partNumber: string;
  serialNumber: string;
  partDescription: string;
  requiredWork: string;
  dateDroppedOff: Date | null;
  estimatedCost: number | null;
  finalCost: number | null;
  terms: string;
  shopReferenceNumber: string;
  estimatedDeliveryDate: Date | null;
  currentStatus: string;
  currentStatusDate: Date | null;
  genThrustStatus: string;
  shopStatus: string;
  trackingNumber: string;
  notes: string;
  lastDateUpdated: Date | null;
  nextDateToUpdate: Date | null;
  checked: string;

  // Computed
  daysOverdue: number;
  isOverdue: boolean;
}

export interface DashboardStats {
  totalActive: number;
  overdue: number;
  waitingQuote: number;
  approved: number;
  beingRepaired: number;
  shipping: number;
  totalValue: number;
}
```

#### Step 3.2: Create Excel Service

Create `src/lib/excelService.ts`:

```typescript
import { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import { RepairOrder } from "../types";

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const FILE_NAME = import.meta.env.VITE_EXCEL_FILE_NAME;
const TABLE_NAME = import.meta.env.VITE_EXCEL_TABLE_NAME;

class ExcelService {
  private msalInstance: IPublicClientApplication | null = null;

  setMsalInstance(instance: IPublicClientApplication) {
    this.msalInstance = instance;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.msalInstance) {
      throw new Error("MSAL instance not set");
    }

    const account = this.msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error("No active account");
    }

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    } catch (error) {
      const response = await this.msalInstance.acquireTokenPopup(loginRequest);
      return response.accessToken;
    }
  }

  private async callGraphAPI(endpoint: string, method = "GET", body?: any) {
    const token = await this.getAccessToken();

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      throw new Error(`Graph API error: ${response.statusText}`);
    }

    return response.json();
  }

  private parseExcelDate(value: any): Date | null {
    if (!value) return null;

    // Excel serial date
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date;
    }

    // ISO string
    if (typeof value === "string") {
      return new Date(value);
    }

    return null;
  }

  private parseCurrency(value: any): number | null {
    if (!value) return null;

    if (typeof value === "number") return value;

    if (typeof value === "string") {
      const cleaned = value.replace(/[$,]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  async getFileId(): Promise<string> {
    // Get site drive
    const sitePath = new URL(SITE_URL).pathname;
    const siteResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/root:${sitePath}`
    );

    // Get drive
    const driveResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
    );

    // Search for file
    const searchResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveResponse.id}/root/search(q='${FILE_NAME}')`
    );

    if (searchResponse.value.length === 0) {
      throw new Error(`File ${FILE_NAME} not found`);
    }

    return searchResponse.value[0].id;
  }

  async getRepairOrders(): Promise<RepairOrder[]> {
    const fileId = await this.getFileId();

    // Get table data
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows`
    );

    const rows = response.value;

    return rows.map((row: any, index: number) => {
      const values = row.values[0]; // First array contains the row data

      const lastUpdated = this.parseExcelDate(values[19]);
      const nextUpdate = this.parseExcelDate(values[20]);
      const today = new Date();

      let daysOverdue = 0;
      let isOverdue = false;

      if (nextUpdate) {
        const diffTime = today.getTime() - nextUpdate.getTime();
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isOverdue = daysOverdue > 0;
      }

      return {
        id: `row-${index}`,
        roNumber: values[0] || "",
        dateMade: this.parseExcelDate(values[1]),
        shopName: values[2] || "",
        partNumber: values[3] || "",
        serialNumber: values[4] || "",
        partDescription: values[5] || "",
        requiredWork: values[6] || "",
        dateDroppedOff: this.parseExcelDate(values[7]),
        estimatedCost: this.parseCurrency(values[8]),
        finalCost: this.parseCurrency(values[9]),
        terms: values[10] || "",
        shopReferenceNumber: values[11] || "",
        estimatedDeliveryDate: this.parseExcelDate(values[12]),
        currentStatus: values[13] || "",
        currentStatusDate: this.parseExcelDate(values[14]),
        genThrustStatus: values[15] || "",
        shopStatus: values[16] || "",
        trackingNumber: values[17] || "",
        notes: values[18] || "",
        lastDateUpdated: lastUpdated,
        nextDateToUpdate: nextUpdate,
        checked: values[21] || "",
        daysOverdue,
        isOverdue,
      };
    });
  }

  async updateRow(
    rowIndex: number,
    columnIndex: number,
    value: any
  ): Promise<void> {
    const fileId = await this.getFileId();

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      "PATCH",
      {
        values: [[value]], // Single cell update
        // For multiple cells: values: [[val1, val2, val3]]
      }
    );
  }

  async updateROStatus(
    rowIndex: number,
    status: string,
    notes?: string
  ): Promise<void> {
    const fileId = await this.getFileId();
    const today = new Date().toISOString();

    // Update: Current Status (col 13), Status Date (col 14), Notes (col 18), Last Updated (col 19)
    const updates: any[] = [];

    // Get current row data first
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`
    );

    const currentValues = response.values[0];

    // Update specific columns
    currentValues[13] = status; // Current Status
    currentValues[14] = today; // Status Date
    if (notes) {
      currentValues[18] = notes; // Notes
    }
    currentValues[19] = today; // Last Updated

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      "PATCH",
      { values: [currentValues] }
    );
  }
}

export const excelService = new ExcelService();
```

---

### PHASE 4: REACT HOOKS (30 minutes)

#### Step 4.1: Create RO Hook

Create `src/hooks/useROs.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { excelService } from "../lib/excelService";
import { RepairOrder, DashboardStats } from "../types";
import { toast } from "sonner";

export function useROs() {
  return useQuery({
    queryKey: ["ros"],
    queryFn: () => excelService.getRepairOrders(),
  });
}

export function useUpdateROStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rowIndex,
      status,
      notes,
    }: {
      rowIndex: number;
      status: string;
      notes?: string;
    }) => excelService.updateROStatus(rowIndex, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update status");
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const ros = await excelService.getRepairOrders();

      const stats: DashboardStats = {
        totalActive: ros.filter(
          (ro) => ro.currentStatus !== "PAID >>>>" && ro.currentStatus !== "BER"
        ).length,
        overdue: ros.filter((ro) => ro.isOverdue).length,
        waitingQuote: ros.filter((ro) =>
          ro.currentStatus.includes("WAITING QUOTE")
        ).length,
        approved: ros.filter((ro) => ro.currentStatus.includes("APPROVED"))
          .length,
        beingRepaired: ros.filter((ro) =>
          ro.currentStatus.includes("BEING REPAIRED")
        ).length,
        shipping: ros.filter((ro) => ro.currentStatus.includes("SHIPPING"))
          .length,
        totalValue: ros.reduce((sum, ro) => sum + (ro.finalCost || 0), 0),
      };

      return stats;
    },
  });
}
```

---

### PHASE 5: UI COMPONENTS (3-4 hours)

#### Step 5.1: Status Badge Component

Create `src/components/StatusBadge.tsx`:

```typescript
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle, Truck } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
}

export function StatusBadge({ status, isOverdue }: StatusBadgeProps) {
  const getStatusStyle = () => {
    if (isOverdue) {
      return "bg-red-100 text-red-800 border-red-300";
    }

    if (status.includes("WAITING QUOTE")) {
      return "bg-yellow-100 text-yellow-800";
    }
    if (status.includes("APPROVED")) {
      return "bg-green-100 text-green-800";
    }
    if (status.includes("BEING REPAIRED")) {
      return "bg-purple-100 text-purple-800";
    }
    if (status.includes("SHIPPING")) {
      return "bg-blue-100 text-blue-800";
    }
    if (status.includes("PAID")) {
      return "bg-gray-100 text-gray-800";
    }

    return "bg-gray-100 text-gray-800";
  };

  const getIcon = () => {
    if (isOverdue) return <AlertCircle className="h-3 w-3" />;
    if (status.includes("WAITING")) return <Clock className="h-3 w-3" />;
    if (status.includes("APPROVED")) return <CheckCircle className="h-3 w-3" />;
    if (status.includes("SHIPPING")) return <Truck className="h-3 w-3" />;
    return null;
  };

  return (
    <Badge className={`${getStatusStyle()} flex items-center gap-1`}>
      {getIcon()}
      {isOverdue ? "⚠️ " : ""}
      {status}
    </Badge>
  );
}
```

#### Step 5.2: Dashboard Component

Create `src/components/Dashboard.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "../hooks/useROs";
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  Wrench,
  Truck,
} from "lucide-react";

export function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (!stats) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      title: "Active ROs",
      value: stats.totalActive,
      icon: Package,
      color: "text-blue-600",
    },
    {
      title: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
      color: "text-red-600",
      alert: stats.overdue > 0,
    },
    {
      title: "Waiting Quote",
      value: stats.waitingQuote,
      icon: Clock,
      color: "text-yellow-600",
    },
    {
      title: "Approved",
      value: stats.approved,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "Being Repaired",
      value: stats.beingRepaired,
      icon: Wrench,
      color: "text-purple-600",
    },
    {
      title: "Shipping",
      value: stats.shipping,
      icon: Truck,
      color: "text-cyan-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <div className="text-sm text-muted-foreground">
          Total Value:{" "}
          <span className="font-semibold">
            {formatCurrency(stats.totalValue)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={stat.alert ? "border-red-300 bg-red-50" : ""}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

#### Step 5.3: RO Table Component

Create `src/components/ROTable.tsx`:

```typescript
import { useState, useMemo } from "react";
import { useROs } from "../hooks/useROs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { RODetailDialog } from "./RODetailDialog";
import { Search, ArrowUpDown } from "lucide-react";
import { RepairOrder } from "../types";

export function ROTable() {
  const { data: ros, isLoading } = useROs();
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof RepairOrder>("roNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRO, setSelectedRO] = useState<RepairOrder | null>(null);

  const filteredAndSorted = useMemo(() => {
    if (!ros) return [];

    // Filter
    let filtered = ros;
    if (search) {
      filtered = ros.filter(
        (ro) =>
          ro.roNumber.toLowerCase().includes(search.toLowerCase()) ||
          ro.shopName.toLowerCase().includes(search.toLowerCase()) ||
          ro.partDescription.toLowerCase().includes(search.toLowerCase()) ||
          ro.serialNumber.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [ros, search, sortColumn, sortDirection]);

  const handleSort = (column: keyof RepairOrder) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return <div className="p-8">Loading repair orders...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ROs, shops, parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredAndSorted.length} of {ros?.length || 0} ROs
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("roNumber")}
                  className="hover:bg-transparent"
                >
                  RO #
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("nextDateToUpdate")}
                  className="hover:bg-transparent"
                >
                  Next Update
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((ro) => (
              <TableRow key={ro.id} className={ro.isOverdue ? "bg-red-50" : ""}>
                <TableCell className="font-medium">{ro.roNumber}</TableCell>
                <TableCell>{ro.shopName}</TableCell>
                <TableCell>
                  <div className="max-w-xs truncate">{ro.partDescription}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={ro.currentStatus}
                    isOverdue={ro.isOverdue}
                  />
                </TableCell>
                <TableCell>
                  <div>{formatDate(ro.nextDateToUpdate)}</div>
                  {ro.isOverdue && (
                    <div className="text-xs text-red-600">
                      {ro.daysOverdue} days overdue
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(ro.finalCost)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRO(ro)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedRO && (
        <RODetailDialog
          ro={selectedRO}
          open={!!selectedRO}
          onClose={() => setSelectedRO(null)}
        />
      )}
    </div>
  );
}
```

#### Step 5.4: RO Detail Dialog

Create `src/components/RODetailDialog.tsx`:

```typescript
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { UpdateStatusDialog } from "./UpdateStatusDialog";
import { RepairOrder } from "../types";

interface RODetailDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}

export function RODetailDialog({ ro, open, onClose }: RODetailDialogProps) {
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>RO #{ro.roNumber}</span>
              <StatusBadge status={ro.currentStatus} isOverdue={ro.isOverdue} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={() => setShowUpdateStatus(true)}>
                Update Status
              </Button>
              <Button variant="outline">Email Shop</Button>
            </div>

            {/* Shop Info */}
            <div>
              <h3 className="font-semibold mb-2">Shop Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Shop:</span>{" "}
                  <span className="font-medium">{ro.shopName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Shop Ref:</span>{" "}
                  {ro.shopReferenceNumber || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground">Terms:</span>{" "}
                  {ro.terms || "N/A"}
                </div>
              </div>
            </div>

            {/* Part Info */}
            <div>
              <h3 className="font-semibold mb-2">Part Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Description:</span>{" "}
                  <span className="font-medium">{ro.partDescription}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Part #:</span>{" "}
                    {ro.partNumber || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Serial #:</span>{" "}
                    {ro.serialNumber || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Required Work:</span>{" "}
                  {ro.requiredWork || "N/A"}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <h3 className="font-semibold mb-2">Timeline</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Date Made:</span>{" "}
                  {formatDate(ro.dateMade)}
                </div>
                <div>
                  <span className="text-muted-foreground">Dropped Off:</span>{" "}
                  {formatDate(ro.dateDroppedOff)}
                </div>
                <div>
                  <span className="text-muted-foreground">Est. Delivery:</span>{" "}
                  {formatDate(ro.estimatedDeliveryDate)}
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>{" "}
                  {formatDate(ro.lastDateUpdated)}
                </div>
                <div
                  className={ro.isOverdue ? "text-red-600 font-semibold" : ""}
                >
                  <span className="text-muted-foreground">Next Update:</span>{" "}
                  {formatDate(ro.nextDateToUpdate)}
                  {ro.isOverdue && ` (${ro.daysOverdue} days overdue)`}
                </div>
              </div>
            </div>

            {/* Costs */}
            <div>
              <h3 className="font-semibold mb-2">Costs</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Estimated:</span>{" "}
                  {formatCurrency(ro.estimatedCost)}
                </div>
                <div>
                  <span className="text-muted-foreground">Final:</span>{" "}
                  <span className="font-medium">
                    {formatCurrency(ro.finalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tracking */}
            {ro.trackingNumber && (
              <div>
                <h3 className="font-semibold mb-2">Shipping</h3>
                <div className="text-sm">
                  <span className="text-muted-foreground">Tracking:</span>{" "}
                  <a
                    href={`https://www.ups.com/track?tracknum=${ro.trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {ro.trackingNumber}
                  </a>
                </div>
              </div>
            )}

            {/* Notes */}
            {ro.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <div className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                  {ro.notes}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showUpdateStatus && (
        <UpdateStatusDialog
          ro={ro}
          open={showUpdateStatus}
          onClose={() => setShowUpdateStatus(false)}
        />
      )}
    </>
  );
}
```

#### Step 5.5: Update Status Dialog

Create `src/components/UpdateStatusDialog.tsx`:

```typescript
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUpdateROStatus } from "../hooks/useROs";
import { RepairOrder } from "../types";

interface UpdateStatusDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  "TO SEND",
  "WAITING QUOTE",
  "APPROVED >>>>",
  "BEING REPAIRED",
  "SHIPPING",
  "PAID >>>>",
  "BER",
];

export function UpdateStatusDialog({
  ro,
  open,
  onClose,
}: UpdateStatusDialogProps) {
  const [status, setStatus] = useState(ro.currentStatus);
  const [notes, setNotes] = useState("");
  const updateStatus = useUpdateROStatus();

  const handleSubmit = () => {
    const rowIndex = parseInt(ro.id.replace("row-", ""));

    updateStatus.mutate(
      { rowIndex, status, notes },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Status - RO #{ro.roNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this status change..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateStatus.isPending}>
            {updateStatus.isPending ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### PHASE 6: MAIN APP (30 minutes)

#### Step 6.1: Create Main App

Update `src/App.tsx`:

```typescript
import { useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "./lib/msalConfig";
import { excelService } from "./lib/excelService";
import { Dashboard } from "./components/Dashboard";
import { ROTable } from "./components/ROTable";
import { Button } from "./components/ui/button";
import { Toaster } from "sonner";
import { LogOut, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAuthenticated) {
      excelService.setMsalInstance(instance);
    }
  }, [isAuthenticated, instance]);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error("Login error:", e);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup().catch((e) => {
      console.error("Logout error:", e);
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              GenThrust RO Tracker
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Track aircraft parts sent to repair stations
            </p>
          </div>
          <Button onClick={handleLogin} className="w-full" size="lg">
            Sign in with Microsoft
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              GenThrust RO Tracker
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{accounts[0]?.name}</span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <Dashboard />
          <div>
            <h2 className="text-2xl font-bold mb-4">Repair Orders</h2>
            <ROTable />
          </div>
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
```

---

### PHASE 7: AZURE AD SETUP (20 minutes)

1. **Go to Azure Portal** (portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: GenThrust RO Tracker
   - **Supported account types**: Single tenant
   - **Redirect URI**:
     - Type: Single-page application (SPA)
     - URI: `http://localhost:5173`
5. Click **Register**
6. Copy the **Application (client) ID** → This is your `VITE_CLIENT_ID`
7. Copy the **Directory (tenant) ID** → This is your `VITE_TENANT_ID`
8. Go to **API permissions**:
   - Click **Add a permission**
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Add:
     - `User.Read`
     - `Files.Read.All`
     - `Files.ReadWrite.All`
     - `Sites.Read.All`
   - Click **Grant admin consent**

---

### PHASE 8: DEPLOYMENT (30 minutes)

#### Option A: Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Add VITE_CLIENT_ID, VITE_TENANT_ID, etc.

# Update Azure AD redirect URI to include:
# https://your-app.vercel.app
```

#### Option B: Deploy to Azure Static Web Apps

```bash
# Build the app
npm run build

# Deploy using Azure Static Web Apps extension in VS Code
# Or use Azure CLI
```

---

## TESTING CHECKLIST

- [ ] Can login with Microsoft account
- [ ] Dashboard shows correct stats
- [ ] Table loads all ROs from Excel
- [ ] Search works across all fields
- [ ] Sorting works on columns
- [ ] Can view RO details
- [ ] Can update status (writes back to Excel)
- [ ] Overdue ROs are highlighted
- [ ] Mobile responsive layout works
- [ ] Auto-refresh every minute works

---

## QUICK WINS / NICE-TO-HAVES (Add Later)

**Week 2+:**

- [ ] Export to PDF/Excel
- [ ] Bulk status updates
- [ ] Email shop directly from app
- [ ] Simple kanban board view
- [ ] Cost tracking chart
- [ ] Shop performance metrics
- [ ] Push notifications for overdue ROs
- [ ] Dark mode

---

## TROUBLESHOOTING

### Authentication Issues

- Check Client ID and Tenant ID are correct
- Verify redirect URI matches exactly (including http vs https)
- Ensure API permissions are granted

### Excel Data Issues

- Verify file name is exact (case-sensitive)
- Check table name in Excel (Data → Table Design)
- Ensure file is in SharePoint (not OneDrive)

### Performance Issues

- Excel has ~10,000 row limit
- Consider pagination if you have >1000 ROs
- Cache time can be adjusted in query client config

---

## COST BREAKDOWN

- **Development**: DIY (your time)
- **Hosting**: $0 (Vercel free tier or Azure Static Web Apps)
- **Azure AD**: $0 (included in Microsoft 365)
- **SharePoint**: $0 (existing)
- **Total**: **$0/month**

---

## TIMELINE

- **Day 1**: Setup project, auth, Excel service (4 hours)
- **Day 2**: Build UI components (4 hours)
- **Day 3**: Polish, testing, deploy (3 hours)
- **Total**: ~11 hours = **2-3 days**

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

---

END OF INSTRUCTIONS
