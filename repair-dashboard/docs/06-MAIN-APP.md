# PHASE 6: MAIN APP (30 minutes)

## Step 6.1: Create Main App

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

## App Structure

### Two States

1. **Unauthenticated**
   - Centered login screen
   - Single "Sign in with Microsoft" button
   - Clean, minimal design

2. **Authenticated**
   - Header with app name, user name, refresh, and logout
   - Main content area with Dashboard and ROTable
   - Toast notifications in bottom-right

---

## Key Features

### Authentication Flow
```
User opens app
  ↓
Not authenticated?
  → Show login screen
  → User clicks "Sign in"
  → Microsoft popup appears
  → User authenticates
  → Redirected back to app
  ↓
Authenticated!
  → Set MSAL instance in Excel service
  → Show main dashboard
```

### Manual Refresh
- Refresh button in header
- Invalidates all queries
- Forces re-fetch from SharePoint
- Useful when Excel is updated externally

### Layout
```
┌─────────────────────────────────────┐
│ Header: Title | User | ↻ | Logout  │
├─────────────────────────────────────┤
│                                     │
│  Dashboard (Stats Cards)            │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Repair Orders Table           │ │
│  │                               │ │
│  │ [Search] [Sort] [Data...]    │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## Toast Notifications

Uses `sonner` library for notifications:

- **Success**: Green toast when status updates successfully
- **Error**: Red toast when update fails
- **Position**: Bottom-right corner
- **Auto-dismiss**: After 3 seconds

---

## Install Sonner

Don't forget to install sonner:

```bash
npm install sonner
```

---

## Checkpoint

At this point you should have:

- ✅ Complete App.tsx with auth logic
- ✅ Login screen for unauthenticated users
- ✅ Main dashboard for authenticated users
- ✅ Header with user info and actions
- ✅ Toast notifications working
- ✅ Manual refresh functionality

**Next:** [Phase 7: Azure AD Setup](07-AZURE-SETUP.md)
