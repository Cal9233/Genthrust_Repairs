# error_handling.md - Error Handling & Recovery System

## Purpose
This document describes the error boundary system implemented to prevent "white screen of death" and provide graceful error recovery in the GenThrust RO Tracker application.

---

## Problem Statement

**Before Implementation:**
- Uncaught JavaScript errors caused complete application crashes
- Users saw blank white screen with no recovery option
- No automatic error logging or tracking
- Required full page refresh to recover
- Poor user experience during network/API failures

**After Implementation:**
- All errors caught and logged automatically
- Users see styled recovery UI with actionable suggestions
- Session state preserved and recoverable
- Different UIs for different error types (network, auth, API, render)
- Errors logged to Winston with full context

---

## Architecture

### Component Hierarchy

```
App.tsx (Root)
└─ ErrorBoundary (level="app")
   ├─ Header
   └─ Main Content
      ├─ ErrorBoundary (level="route", key="repairs")
      │  └─ Dashboard
      ├─ ErrorBoundary (level="route", key="inventory")
      │  └─ InventorySearchTab
      ├─ ErrorBoundary (level="route", key="shops")
      │  └─ ShopDirectory
      └─ ErrorBoundary (level="route", key="analytics")
         └─ ShopAnalyticsTab
```

### Error Flow

```
1. Error thrown in component
   ↓
2. Nearest ErrorBoundary catches error
   ↓
3. ErrorBoundary.componentDidCatch() invoked
   ↓
4. Error analyzed (detectErrorType)
   ↓
5. Error logged to Winston (with sanitization)
   ↓
6. Session recovery data saved
   ↓
7. ErrorFallback UI displayed
   ↓
8. User chooses action:
   - Try Again (reset boundary)
   - Reload Page (window.location.reload)
   - Go Home (navigate to /)
   - Sign In Again (re-authenticate)
   ↓
9. Boundary resets, app recovers
```

---

## Components Created

### 1. ErrorBoundary.tsx
**Location:** `src/components/ErrorBoundary.tsx`

**Type:** React Class Component (required for error boundaries)

**Purpose:** Catches errors in child component tree and displays fallback UI.

**Key Features:**
- Multi-level support (app, route, component)
- Automatic Winston logging with context
- Session recovery mechanism
- Error count tracking
- Auto-reset on prop changes (resetKeys)
- Custom fallback support

**Props:**
```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error, errorInfo, resetError) => ReactNode;
  onError?: (error, errorInfo) => void;
  onReset?: () => void;
  onSignIn?: () => void;
  resetKeys?: Array<string | number>;  // Auto-reset when these change
  level?: 'app' | 'route' | 'component';
}
```

**Usage:**
```tsx
// App-level
<ErrorBoundary level="app" onSignIn={handleSignIn}>
  <App />
</ErrorBoundary>

// Route-level with auto-reset
<ErrorBoundary level="route" resetKeys={["repairs"]}>
  <Dashboard />
</ErrorBoundary>
```

---

### 2. ErrorFallback.tsx
**Location:** `src/components/ErrorFallback.tsx`

**Type:** React Functional Component

**Purpose:** Beautiful styled fallback UI displayed when errors occur.

**Key Features:**
- Error type detection (network, auth, API, render, unknown)
- Color-coded themes per error type
- User-friendly error messages
- Actionable recovery suggestions
- Expandable technical details
- Development mode indicators
- GenThrust branding (logo)

**Error Type Themes:**
| Type | Color | Icon | Actions |
|------|-------|------|---------|
| Network | Orange | AlertCircle | Try Again, Reload |
| Auth | Red | LogIn | Sign In Again, Reload |
| API | Blue | AlertCircle | Try Again, Reload |
| Render | Purple | AlertCircle | Try Again, Reload |
| Unknown | Gray | AlertCircle | Reload, Go Home |

**Props:**
```typescript
interface ErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo;
  resetError: () => void;
  onSignIn?: () => void;
}
```

---

### 3. errorUtils.ts
**Location:** `src/utils/errorUtils.ts`

**Type:** Utility Functions

**Purpose:** Error detection, classification, and recovery utilities.

**Key Functions:**

```typescript
// Detect error type based on error properties
detectErrorType(error: Error): 'network' | 'auth' | 'render' | 'api' | 'unknown'

// Get detailed error information
getErrorInfo(error: Error): ErrorInfo

// Get recovery suggestions for error type
getRecoverySuggestions(type: ErrorType): string[]

// Format error for Winston logging (sanitize sensitive data)
formatErrorForLogging(error: Error, errorInfo?: React.ErrorInfo): object

// Check if error is recoverable
isRecoverable(error: Error): boolean

// Session recovery
getSessionRecoveryData(): object
attemptSessionRestore(recoveryData: object): void
```

**Detection Patterns:**

```typescript
// Network errors
errorMessage.includes('network') ||
errorMessage.includes('fetch') ||
errorMessage.includes('timeout')

// Auth errors
errorMessage.includes('unauthorized') ||
errorMessage.includes('401') ||
errorMessage.includes('token')

// API errors
errorMessage.includes('api') ||
errorMessage.includes('graph') ||
errorMessage.includes('sharepoint')

// Render errors
errorMessage.includes('render') ||
errorMessage.includes('component')
```

---

## Integration Points

### App.tsx Integration

**Changes Made:**

1. **Import ErrorBoundary:**
```typescript
import { ErrorBoundary } from "./components/ErrorBoundary";
```

2. **App-Level Boundary:**
```typescript
return (
  <ErrorBoundary
    level="app"
    onSignIn={handleErrorSignIn}
    resetKeys={[currentView, isAuthenticated]}
  >
    <div className="min-h-screen">
      {/* App content */}
    </div>
  </ErrorBoundary>
);
```

3. **Route-Level Boundaries:**
```typescript
{currentView === "repairs" ? (
  <ErrorBoundary level="route" resetKeys={["repairs"]}>
    <Dashboard />
  </ErrorBoundary>
) : currentView === "inventory" ? (
  <ErrorBoundary level="route" resetKeys={["inventory"]}>
    <InventorySearchTab />
  </ErrorBoundary>
) : ...}
```

4. **Auth Error Handler:**
```typescript
const handleErrorSignIn = async () => {
  try {
    await instance.loginPopup(loginRequest);
  } catch (e: any) {
    // Handle auth errors
  }
};
```

---

## Winston Logger Integration

### Automatic Error Logging

Every error caught by ErrorBoundary is automatically logged:

```typescript
logger.error(`[${level.toUpperCase()}] Error caught by boundary`, error, {
  name: error.name,
  message: error.message,
  stack: error.stack,
  componentStack: errorInfo.componentStack,
  level: 'app' | 'route' | 'component',
  errorCount: number,
  recoverable: boolean,
  timestamp: ISO string,
  userAgent: string,
  url: string
});
```

**Sensitive Data Sanitization:**
- API keys removed
- Tokens redacted
- Passwords masked
- Email addresses sanitized (per logger.ts patterns)

**Log Levels:**
- `error` - When error is caught
- `warn` - When 3+ errors occur (suggests reload)
- `info` - When boundary resets successfully

---

## Session Recovery

### Recovery Data Saved

When error occurs, system captures:

```typescript
{
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  timestamp: Date.now()
}
```

### Recovery Process

1. User clicks "Try Again"
2. `resetError()` called
3. Session data restored (if available)
4. Component tree re-renders
5. User returns to same view

**Limitations:**
- Does not restore form inputs
- Does not restore scroll position
- React Query cache preserved separately

---

## Error Type Handling

### Network Errors

**Detection:**
- "network" in message
- "fetch" in message
- "connection" in message
- "timeout" in message

**User Message:**
> "Unable to connect to the server. Please check your internet connection and try again."

**Recovery Suggestions:**
1. Check your internet connection
2. Verify you can access other websites
3. Try disabling VPN if active
4. Wait a moment and try again

---

### Authentication Errors

**Detection:**
- "unauthorized" in message
- "authentication" in message
- "token" in message
- "401" or "403" in message

**User Message:**
> "Your session has expired or you do not have permission to access this resource. Please sign in again."

**Recovery Suggestions:**
1. Click the "Sign In Again" button
2. Clear browser cache and cookies
3. Ensure pop-ups are not blocked
4. Contact administrator if issue persists

**Special Handling:**
- Shows "Sign In Again" button
- Calls `onSignIn` prop when clicked
- Triggers MSAL authentication flow

---

### API Errors

**Detection:**
- "api" in message
- "graph" in message
- "sharepoint" in message
- "excel" in message
- "404", "500", "429" in message

**User Message:**
> "There was an issue communicating with Microsoft services. The service may be temporarily unavailable."

**Recovery Suggestions:**
1. Wait a few moments and try again
2. Check Microsoft services status
3. Try refreshing the page
4. Contact support if error continues

---

### Render Errors

**Detection:**
- "render" in message
- "component" in message
- "react" in message

**User Message:**
> "An unexpected error occurred while displaying this content. Please refresh the page."

**Recovery Suggestions:**
1. Try refreshing the page
2. Clear your browser cache
3. Try using a different browser
4. Contact support with error details

---

## Configuration

### Boundary Levels

**App-Level (`level="app"`):**
- Wraps entire application
- Full-screen ErrorFallback UI
- Used for catastrophic failures
- Cannot be dismissed (must reset)

**Route-Level (`level="route"`):**
- Wraps individual tabs/routes
- Full-screen ErrorFallback (for consistency)
- User can navigate to other routes
- Auto-resets when route changes

**Component-Level (`level="component"`):**
- Wraps individual components
- Inline error UI (small card)
- Minimal disruption to rest of app
- Shows "Try Again" button

### Reset Keys

Auto-reset boundary when dependencies change:

```typescript
<ErrorBoundary resetKeys={[currentView, userId, selectedRO]}>
  {/* Boundary auto-resets if any resetKey changes */}
</ErrorBoundary>
```

**Use Cases:**
- Reset when navigating between tabs
- Reset when user logs in/out
- Reset when selecting different data

---

## Development vs Production

### Development Mode

**Visible by default:**
- Full stack traces
- Component stack traces
- Error name and message
- All technical details
- "Development Mode" indicator

**Console Output:**
```
🚨 Error Boundary (app)
  Error: Cannot read property 'name' of undefined
  Error Info: { componentStack: "..." }
  Component Stack: at Component (...)
```

### Production Mode

**Hidden by default (expandable):**
- Stack traces (click to show)
- Component stacks
- Technical details

**Visible always:**
- User-friendly message
- Recovery suggestions
- Action buttons
- Support contact info

**Security:**
- Sensitive data sanitized in logs
- API keys/tokens redacted
- No internal URLs exposed

---

## Usage Patterns

### Basic Usage

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function MyComponent() {
  return (
    <ErrorBoundary level="component">
      <ComponentThatMightError />
    </ErrorBoundary>
  );
}
```

### With Custom Fallback

```tsx
<ErrorBoundary
  fallback={(error, errorInfo, reset) => (
    <div>
      <h1>Custom Error UI</h1>
      <button onClick={reset}>Reset</button>
    </div>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

### With Error Callback

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Send to analytics
    analytics.track('error', {
      error: error.message,
      component: errorInfo.componentStack
    });
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### Imperative Error Handling

For errors in event handlers (not caught by boundaries):

```tsx
import { useErrorHandler } from '@/components/ErrorBoundary';

function MyComponent() {
  const handleError = useErrorHandler();

  const handleClick = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      handleError(error); // Will be caught by nearest boundary
    }
  };

  return <button onClick={handleClick}>Do Something</button>;
}
```

---

## Testing

### Manual Testing

**Test Network Errors:**
1. Disconnect internet
2. Trigger data fetch
3. Should show orange network error UI

**Test Auth Errors:**
1. Manually expire token (clear sessionStorage)
2. Trigger API call
3. Should show red auth error with "Sign In Again"

**Test Render Errors:**
1. Throw error in component render
2. Should show purple render error UI

**Example Test Component:**
```tsx
function ErrorTester() {
  const [shouldError, setShouldError] = useState(false);

  if (shouldError) {
    throw new Error('Test error');
  }

  return <button onClick={() => setShouldError(true)}>Trigger Error</button>;
}
```

### Automated Testing

**Unit Tests (Future):**
```typescript
describe('ErrorBoundary', () => {
  it('catches errors and shows fallback', () => {
    // Test error catching
  });

  it('resets on resetKeys change', () => {
    // Test auto-reset
  });

  it('logs errors to Winston', () => {
    // Test logging
  });
});
```

---

## Monitoring

### Error Tracking

**Current (Winston Logs):**
- All errors logged to console (dev)
- Logs include full context
- Searchable in browser console

**Future (Planned):**
- Application Insights integration
- Error rate dashboards
- Alerting on error spikes
- User-affected metrics

### Key Metrics

**Track:**
- Error rate (errors per session)
- Error types distribution
- Recovery success rate
- Errors by component/route
- Errors by user/browser

---

## Troubleshooting

### Error Boundary Not Catching Errors

**Cause:** Errors thrown in async code or event handlers aren't caught.

**Solution:** Use `useErrorHandler` hook:
```tsx
const handleError = useErrorHandler();
try { await async(); } catch (e) { handleError(e); }
```

### Boundary Keeps Resetting

**Cause:** resetKeys changing on every render.

**Solution:** Stabilize resetKeys with useMemo or use primitive values.

### Too Many Errors Message

**Cause:** Same error occurring 3+ times.

**Solution:** Fix underlying error or increase threshold in errorBoundary.tsx.

### Stack Trace Not Showing

**Cause:** Production mode or error missing stack.

**Solution:** Click "Show Technical Details" or check DEV mode.

---

## Future Enhancements

### Planned Features

1. **Error Recovery Strategies**
   - Automatic retry with exponential backoff
   - Stale data fallback (show cached data)
   - Partial UI degradation (hide failing section, show rest)

2. **Better Analytics**
   - Application Insights integration
   - Error dashboards
   - User impact analysis

3. **Offline Support**
   - Queue failed requests
   - Show offline indicator
   - Sync when back online

4. **Smart Recovery**
   - Detect transient errors (auto-retry)
   - Detect permanent errors (don't retry)
   - Suggest alternative actions

---

## Files Modified/Created

### Created Files

1. `repair-dashboard/src/components/ErrorBoundary.tsx` - Main boundary component
2. `repair-dashboard/src/components/ErrorFallback.tsx` - Fallback UI component
3. `repair-dashboard/src/utils/errorUtils.ts` - Error utilities
4. `.claude/error_handling.md` - This documentation

### Modified Files

1. `repair-dashboard/src/App.tsx` - Added app-level and route-level boundaries

**Total:** 4 new files, 1 modified file, ~770 lines added

---

## Best Practices

### Do's

✅ Wrap entire app with app-level boundary
✅ Add route-level boundaries for major sections
✅ Use resetKeys to auto-reset on navigation
✅ Log all errors with context
✅ Provide actionable recovery suggestions
✅ Test error scenarios during development
✅ Use useErrorHandler for async errors

### Don'ts

❌ Don't use boundaries for flow control
❌ Don't catch errors you can handle normally
❌ Don't show technical details in production (without user expanding)
❌ Don't log sensitive data (passwords, tokens)
❌ Don't nest too many boundary levels (creates confusion)
❌ Don't rely on boundaries for validation errors

---

## References

### Internal Documentation
- `architecture.md` - Overall system architecture
- `modules.md` - Component and module organization
- `view.md` - UI component patterns
- `CLAUDE.md` - Main project guide

### External Resources
- [React Error Boundaries Docs](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Winston Logger](https://github.com/winstonjs/winston)
- [Error Handling Best Practices](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react)

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Implemented by:** Claude Code
**Maintained by:** Cal9233/Claude Code
