# PHASE 2: MICROSOFT AUTHENTICATION (1 hour)

## Step 2.1: Create MSAL Config

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

---

## Step 2.2: Setup MSAL in Main App

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

## Key Concepts

### MSAL (Microsoft Authentication Library)
- Handles authentication with Azure AD
- Manages tokens automatically
- Uses popup flow for login

### Scopes Required
- `User.Read`: Get user profile info
- `Files.ReadWrite`: Read and write files in SharePoint
- `Sites.Read.All`: Access SharePoint sites

### Session Storage
- Keeps user logged in during browser session
- More secure than localStorage
- Clears on browser close

---

## Testing Authentication

Before moving to the next phase, you should be able to:

1. Start the dev server: `npm run dev`
2. See a login button
3. Click login and authenticate with Microsoft
4. See your name displayed after login

---

## Checkpoint

At this point you should have:

- ✅ MSAL configuration created
- ✅ Authentication providers set up
- ✅ Query client configured with auto-refresh
- ✅ Basic login flow working

**Next:** [Phase 3: Excel Service](03-EXCEL-SERVICE.md)
