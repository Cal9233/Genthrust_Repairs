import type { Configuration, PopupRequest } from "@azure/msal-browser";

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
  scopes: [
    "User.Read",
    "Files.ReadWrite",
    "Sites.Read.All",
    "Tasks.ReadWrite",      // For Microsoft To Do reminders
    "Calendars.ReadWrite",  // For Calendar reminders
    // These scopes require user consent but NOT admin consent
  ],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};
