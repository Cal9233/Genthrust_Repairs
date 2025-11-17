# view.md - View/UI Layer Documentation

## Purpose
This document describes the user interface components, layout structure, styling approach, and UI patterns used in the GenThrust RO Tracker.

---

## UI Architecture

```
App.tsx (Root)
├── Header
│   ├── Logo
│   ├── Navigation Tabs (Repairs, Inventory, Shops, Analytics)
│   └── Action Buttons (AI Assistant, Logs, Theme, Refresh, Logout)
│
└── Main Content (Tab-based)
    ├── Repairs Tab (default)
    │   └── Dashboard.tsx
    │       ├── KPI Cards (stats)
    │       └── ROTable.tsx
    │           ├── Search & Filters
    │           ├── Table (sortable, paginated)
    │           └── Row Actions
    │
    ├── Inventory Tab
    │   └── InventorySearchTab.tsx
    │       ├── Search Input
    │       └── Results Table
    │
    ├── Shops Tab
    │   └── ShopDirectory.tsx
    │       ├── Search & Filters
    │       └── Shop List/Cards
    │
    └── Analytics Tab (advanced users only)
        └── ShopAnalyticsTab.tsx
            ├── Shop Selector
            └── Metrics Display
```

---

## Component Catalog

### Main Views

#### 1. App.tsx
**Purpose:** Root application component with authentication and navigation

**Key Features:**
- Microsoft authentication (login/logout)
- Tab-based navigation
- Keyboard shortcuts (Ctrl+K for AI)
- Responsive header
- Theme toggle

**Props:** None (root component)

**State:**
```typescript
const [currentView, setCurrentView] = useState<"repairs" | "inventory" | "shops" | "analytics">("repairs");
const [showAIAgent, setShowAIAgent] = useState(false);
const [showLogs, setShowLogs] = useState(false);
```

**File Location:** `src/App.tsx`

---

#### 2. Dashboard.tsx
**Purpose:** Main dashboard with KPIs and repair orders table

**Sections:**
1. **KPI Grid** - Statistics cards
2. **ROTable** - Main data table

**KPI Cards:**
- Total Active ROs
- Overdue (red if > 0)
- Waiting Quote
- Approved
- Being Repaired
- Shipping
- Total Value (financial)

**File Location:** `src/components/Dashboard.tsx`

---

#### 3. ROTable.tsx
**Purpose:** Sortable, filterable table of repair orders

**Features:**
- Multi-column search
- Smart filters (overdue, high value, due this week, by shop)
- Column sorting (click headers)
- Row highlighting (overdue = red background)
- Bulk selection (checkboxes)
- Row click → Detail dialog

**Columns Displayed:**
- RO Number
- Shop Name
- Part Description
- Status Badge
- Next Update Date
- Days Overdue (if applicable)
- Cost
- Actions (View button)

**Interactions:**
- Click row → Open RODetailDialog
- Click checkbox → Add to bulk selection
- Click column header → Sort by that column
- Type in search → Filter table

**File Location:** `src/components/ROTable.tsx`

---

#### 4. RODetailDialog.tsx
**Purpose:** Comprehensive detail view of a single repair order

**Tabs:**
1. **Overview** - Main RO info
2. **Status History** - Timeline of status changes
3. **Attachments** - Files uploaded for this RO

**Overview Tab Sections:**
- Action Buttons (Update Status, Email Shop, Create Reminder, Archive, Delete)
- Shop Information (Name, Contact, Terms, Reference Number)
- Part Information (Description, PN, SN, Required Work)
- Timeline (Date Made, Dropped Off, Est. Delivery, Last Updated, Next Update)
- Costs (Estimated, Final, Variance if different)
- Shipping (Tracking number with clickable link)
- Notes (freeform text)

**Status History Tab:**
- Visual timeline component (StatusTimeline)
- Shows all status changes with dates, users, costs, notes

**Attachments Tab:**
- Upload button
- List of files with download/delete options
- Drag-and-drop upload zone

**Props:**
```typescript
interface RODetailDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}
```

**File Location:** `src/components/RODetailDialog.tsx`

---

#### 5. ShopDirectory.tsx
**Purpose:** Manage repair shops and vendors

**Layout:**
- Search bar
- Add New Shop button
- Shop cards/list (responsive)

**Shop Card Content:**
- Business name
- Contact person
- Phone, email
- City, State
- Payment terms
- YTD Sales
- Edit/Delete buttons

**Interactions:**
- Click "Add Shop" → ShopManagementDialog
- Click "Edit" on shop → ShopManagementDialog (edit mode)
- Click "Delete" → Confirmation dialog

**File Location:** `src/components/ShopDirectory.tsx`

---

#### 6. InventorySearchTab.tsx
**Purpose:** Search GenThrust inventory database

**Layout:**
- Part number search input (debounced)
- Results table

**Results Columns:**
- Part Number
- Serial Number
- Qty
- Condition (OH, SV, etc.)
- Location (BIN-A1, etc.)
- Description
- Table Name (source table)
- Last Seen (date)

**Special Features:**
- Debounced search (300ms)
- Backend API call
- "Create RO from Part" button (planned)

**File Location:** `src/components/InventorySearchTab.tsx`

---

#### 7. ShopAnalyticsTab.tsx
**Purpose:** Shop performance metrics (advanced users only)

**Access Control:**
```typescript
const hasAdvancedAccess = accounts[0]?.username === 'cmalagon@genthrust.net';
```

**Metrics Displayed:**
- Total ROs with shop
- Active ROs
- Completed ROs
- Average turnaround time
- On-time delivery rate
- Total spent
- Average cost per RO
- BER/RAI rates
- Recent activity (last 30 days)

**File Location:** `src/components/ShopAnalyticsTab.tsx`

---

### Dialogs (Modals)

#### 1. AddRODialog.tsx
**Purpose:** Create new RO or edit existing

**Mode Detection:**
```typescript
const isEditMode = !!initialRO;
```

**Form Fields:**
- RO Number (auto-generated or manual)
- Shop Name (dropdown from shop directory)
- Part Number
- Serial Number
- Part Description
- Required Work (textarea)
- Date Made (date picker)
- Date Dropped Off (date picker)
- Estimated Cost (currency input)
- Payment Terms (text)
- Shop Reference Number
- Estimated Delivery Date (date picker)
- Initial Status (dropdown)
- Notes (textarea)

**Validation:**
- RO Number required
- Shop Name required
- Part Description required

**Props:**
```typescript
interface AddRODialogProps {
  open: boolean;
  onClose: () => void;
  initialRO?: RepairOrder;  // For edit mode
}
```

**File Location:** `src/components/AddRODialog.tsx`

---

#### 2. UpdateStatusDialog.tsx
**Purpose:** Change RO status with archival logic

**Form Fields:**
- New Status (dropdown)
- Notes (textarea)
- Cost (if quote received)
- Delivery Date (if approved)

**Smart Archival:**
- If new status = RECEIVED → Check payment terms
  - NET terms → Offer to archive to NET sheet
  - Other terms → Offer to archive to PAID sheet
  - Unclear → Show ArchiveDestinationDialog
- If new status = PAID/PAYMENT SENT → Offer to archive to PAID sheet
- If new status = BER/RAI → Offer to archive to Returns sheet

**Business Logic Integration:**
- Calculates next update date automatically (businessRules.ts)
- Updates status history
- Creates reminder if configured

**Props:**
```typescript
interface UpdateStatusDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}
```

**File Location:** `src/components/UpdateStatusDialog.tsx`

---

#### 3. ArchiveDestinationDialog.tsx
**Purpose:** User chooses PAID vs NET when terms are unclear

**Display:**
- Explanation text
- Two large buttons: "PAID" and "NET"
- Cancel option

**Use Case:**
- Status changed to RECEIVED
- Payment terms don't match NET pattern
- System can't determine destination automatically

**Props:**
```typescript
interface ArchiveDestinationDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
  onConfirm: (destination: 'PAID' | 'NET') => void;
}
```

**File Location:** `src/components/ArchiveDestinationDialog.tsx`

---

#### 4. AIAgentDialog.tsx
**Purpose:** Chat interface for Claude AI assistant

**Features:**
- Chat history display
- Streaming responses (real-time)
- Tool use execution
- Message input (textarea)
- Keyboard shortcut (Ctrl+K to open)

**Message Types:**
1. User messages
2. AI text responses
3. Tool execution notifications
4. Error messages

**Props:**
```typescript
interface AIAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Conversation Flow:**
```
User: "Update RO 12345 to RECEIVED"
  ↓
AI: "I'll update RO 12345 to RECEIVED status."
  ↓
[Tool: update_repair_order executing...]
  ↓
AI: "✓ Successfully updated RO 12345 to RECEIVED."
```

**File Location:** `src/components/AIAgentDialog.tsx`

---

#### 5. EmailComposerDialog.tsx
**Purpose:** Compose and send emails to shops

**Form Fields:**
- To (email address - pre-filled from shop)
- Subject (pre-filled from template)
- Body (textarea - pre-filled from template, editable)

**Email Templates:**
- Quote Request
- Status Update Request
- Approval Confirmation
- Custom

**Props:**
```typescript
interface EmailComposerDialogProps {
  ro: RepairOrder;
  shop: Shop;
  open: boolean;
  onClose: () => void;
  initialTemplate?: 'quote' | 'update' | 'approval';
}
```

**File Location:** `src/components/EmailComposerDialog.tsx`

---

#### 6. ShopManagementDialog.tsx
**Purpose:** Add or edit shop information

**Form Fields:**
- Business Name
- Customer Number
- Contact Person
- Phone
- Toll-Free
- Fax
- Email
- Website
- Address Lines (4 fields)
- City, State, Zip, Country
- Payment Terms
- ILS Code
- YTD Sales
- Last Sale Date

**Validation:**
- Business Name required
- Email format validation
- Phone format (optional)

**Props:**
```typescript
interface ShopManagementDialogProps {
  open: boolean;
  onClose: () => void;
  initialShop?: Shop;  // For edit mode
}
```

**File Location:** `src/components/ShopManagementDialog.tsx`

---

#### 7. LogsDialog.tsx
**Purpose:** View AI interaction logs

**Features:**
- Date selector
- Log entry table
- Export logs to Excel
- Filter by action type

**Columns:**
- Timestamp
- User
- Action
- RO Number (if applicable)
- Details
- Result (success/error)

**Props:**
```typescript
interface LogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**File Location:** `src/components/LogsDialog.tsx`

---

### Feature Components

#### 1. StatusTimeline.tsx
**Purpose:** Visual timeline of status history

**Display:**
- Vertical timeline
- Each entry shows:
  - Status badge
  - Date
  - User who made change
  - Cost (if updated)
  - Notes
  - Delivery date (if updated)

**Visual Design:**
- Dots with connecting line
- Color-coded by status
- Most recent at top

**Props:**
```typescript
interface StatusTimelineProps {
  history: StatusHistoryEntry[];
}
```

**File Location:** `src/components/StatusTimeline.tsx`

---

#### 2. StatusBadge.tsx
**Purpose:** Color-coded status indicator

**Status Colors:**
| Status | Color | Background |
|--------|-------|------------|
| TO SEND | Blue | Light Blue |
| WAITING QUOTE | Yellow | Light Yellow |
| APPROVED | Green | Light Green |
| BEING REPAIRED | Purple | Light Purple |
| CURRENTLY BEING SHIPPED | Cyan | Light Cyan |
| RECEIVED | Teal | Light Teal |
| SHIPPING | Indigo | Light Indigo |
| PAID/PAYMENT SENT | Gray | Light Gray |
| BER | Slate | Light Slate |
| Overdue | Red | Light Red |

**Icons:**
- Clock (WAITING)
- CheckCircle (APPROVED)
- Truck (SHIPPING)
- AlertCircle (Overdue)

**Props:**
```typescript
interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
}
```

**File Location:** `src/components/StatusBadge.tsx`

---

#### 3. AttachmentManager.tsx
**Purpose:** Upload, download, delete file attachments

**Features:**
- Drag-and-drop upload
- Click to browse upload
- File list with metadata
- Download button (downloads file)
- Delete button (with confirmation)

**File Display:**
- File name
- File size (formatted)
- Upload date
- Uploaded by (user)
- Actions (download, delete)

**Props:**
```typescript
interface AttachmentManagerProps {
  roNumber: string;
}
```

**File Location:** `src/components/AttachmentManager.tsx`

---

#### 4. BulkActionsBar.tsx
**Purpose:** Actions for multiple selected ROs

**Appears When:** One or more ROs selected (checkboxes)

**Actions:**
- Bulk Status Update
- Bulk Archive
- Export to CSV
- Clear Selection

**Display:**
- Sticky bar at bottom of screen
- Selection count: "5 ROs selected"
- Action buttons

**Props:**
```typescript
interface BulkActionsBarProps {
  selectedROs: RepairOrder[];
  onClearSelection: () => void;
}
```

**File Location:** `src/components/BulkActionsBar.tsx`

---

#### 5. ThemeToggle.tsx
**Purpose:** Switch between light and dark mode

**Implementation:**
```typescript
const { theme, toggleTheme } = useTheme();

// Toggle button with icons
<Button onClick={toggleTheme}>
  {theme === 'dark' ? <Sun /> : <Moon />}
</Button>
```

**Theme Persistence:** Stored in localStorage

**File Location:** `src/components/ThemeToggle.tsx`

---

## Styling Approach

### Tailwind CSS Utility Classes

**Common Patterns:**

**Buttons:**
```jsx
<Button className="bg-gradient-blue text-white hover:shadow-lg transition-all">
  Action
</Button>
```

**Cards:**
```jsx
<Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
  Content
</Card>
```

**Status Colors (CSS Variables):**
```css
:root {
  --primary-deep-blue: 203 89% 22%;
  --bright-blue: 199 89% 48%;
  --electric: 186 100% 54%;
  --card-blue: 203 65% 96%;
}
```

---

### Responsive Design

**Breakpoints (Tailwind defaults):**
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+

**Mobile Optimizations:**
- Collapsible navigation tabs (horizontal scroll)
- Stacked cards on mobile
- Reduced padding/margins
- Larger touch targets (48px minimum)
- Hamburger menu (if needed)

**Example:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column mobile, 2 tablet, 3 desktop */}
</div>
```

---

### Dark Mode

**Implementation:**
- CSS class toggle on `<html>` element: `class="dark"`
- Tailwind's `dark:` variant
- CSS variables for colors

**Example:**
```jsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  Content
</div>
```

---

## UI Patterns & Best Practices

### Loading States

**Skeleton Loaders:**
```jsx
{isLoading ? (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 rounded"></div>
    <div className="h-8 bg-gray-200 rounded"></div>
  </div>
) : (
  <DataTable data={data} />
)}
```

**Spinners:**
```jsx
{isMutating && <Loader2 className="animate-spin" />}
```

---

### Error States

**Error Messages:**
```jsx
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

---

### Toast Notifications

**Usage:**
```typescript
import { toast } from 'sonner';

// Success
toast.success('RO updated successfully');

// Error
toast.error('Failed to update RO');

// Loading (promise-based)
toast.promise(
  updateRO(),
  {
    loading: 'Updating...',
    success: 'Updated!',
    error: 'Failed'
  }
);
```

---

### Confirmation Dialogs

**Pattern:**
```jsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Delete</DialogTitle>
      <DialogDescription>
        This action cannot be undone. Delete RO {roNumber}?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button variant="destructive" onClick={onConfirm}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Form Validation

**Pattern:**
```jsx
const [errors, setErrors] = useState({});

const validate = () => {
  const newErrors = {};
  if (!roNumber) newErrors.roNumber = 'Required';
  if (!shopName) newErrors.shopName = 'Required';
  return newErrors;
};

const handleSubmit = () => {
  const validationErrors = validate();
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }
  // Submit
};
```

---

### Keyboard Navigation

**Accessible Dialogs:**
- Escape key closes
- Tab navigation works
- Focus trap within dialog
- Auto-focus on first input

**Keyboard Shortcuts:**
- `Ctrl+K` → Open AI Assistant
- `Esc` → Close modals
- `Enter` → Submit forms

---

## Accessibility (a11y)

### ARIA Labels

**Example:**
```jsx
<Button aria-label="Refresh repair orders">
  <RefreshCw className="h-4 w-4" />
</Button>
```

### Focus Management

- Dialogs trap focus
- Visible focus indicators
- Skip to main content link (planned)

### Screen Reader Support

- Semantic HTML (`<header>`, `<main>`, `<nav>`)
- ARIA roles where needed
- Alt text for images

---

## Component Testing

**Test Files:**
- `ROTable.test.tsx`
- `RODetailDialog.test.tsx`
- `UpdateStatusDialog.test.tsx`
- `StatusTimeline.test.tsx`

**Example Test:**
```typescript
describe('ROTable', () => {
  it('renders repair orders', () => {
    render(<ROTable />);
    expect(screen.getByText('RO-12345')).toBeInTheDocument();
  });

  it('filters by search term', () => {
    render(<ROTable />);
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Duncan' } });
    expect(screen.getByText('Duncan Aviation')).toBeInTheDocument();
  });
});
```

---

**Version:** 1.0
**Last Updated:** 2025-11-17
**Maintained by:** Cal9233/Claude Code
