# PHASE 5: UI COMPONENTS (3-4 hours)

This is the longest phase where we build all the UI components. We'll create 5 main components:

1. StatusBadge
2. Dashboard
3. ROTable
4. RODetailDialog
5. UpdateStatusDialog

---

## Component 1: StatusBadge

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

---

## Component 2: Dashboard

Create `src/components/Dashboard.tsx`:

See [Full Code in Original Instructions - Lines 693-799](../INSTRUCTIONS.md#L693-L799)

Key features:
- 6 stat cards (Active, Overdue, Waiting Quote, Approved, Being Repaired, Shipping)
- Total value display
- Color-coded cards
- Icons from lucide-react
- Alert styling for overdue items

---

## Component 3: ROTable

Create `src/components/ROTable.tsx`:

See [Full Code in Original Instructions - Lines 803-989](../INSTRUCTIONS.md#L803-L989)

Key features:
- Search box (searches across RO#, shop, part, serial)
- Sortable columns
- Overdue row highlighting
- Click to view detail
- Formatted dates and currency

---

## Component 4: RODetailDialog

Create `src/components/RODetailDialog.tsx`:

See [Full Code in Original Instructions - Lines 993-1187](../INSTRUCTIONS.md#L993-L1187)

Key features:
- Full RO details in organized sections
- Shop info, part info, timeline, costs
- Update status button
- Tracking number with link to UPS
- Notes display

---

## Component 5: UpdateStatusDialog

Create `src/components/UpdateStatusDialog.tsx`:

See [Full Code in Original Instructions - Lines 1191-1301](../INSTRUCTIONS.md#L1191-L1301)

Key features:
- Status dropdown with predefined options
- Optional notes textarea
- Submit button with loading state
- Integrates with `useUpdateROStatus` hook

---

## Component Organization

```
src/components/
├── ui/                    # shadcn components (auto-generated)
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   ├── textarea.tsx
│   └── label.tsx
├── StatusBadge.tsx        # Status indicator with colors
├── Dashboard.tsx          # Stats overview
├── ROTable.tsx            # Main data table
├── RODetailDialog.tsx     # Full RO details
└── UpdateStatusDialog.tsx # Status update form
```

---

## Styling Notes

### Color Scheme
- **Overdue**: Red (bg-red-50, text-red-600, border-red-300)
- **Waiting Quote**: Yellow (bg-yellow-100, text-yellow-800)
- **Approved**: Green (bg-green-100, text-green-800)
- **Being Repaired**: Purple (bg-purple-100, text-purple-800)
- **Shipping**: Blue (bg-blue-100, text-blue-800)
- **Paid/Completed**: Gray (bg-gray-100, text-gray-800)

### Responsive Design
- Mobile-first approach
- Grid columns collapse on small screens
- Table scrolls horizontally on mobile
- Dialog max height with scroll

---

## Checkpoint

At this point you should have:

- ✅ StatusBadge component with color coding
- ✅ Dashboard component with stats cards
- ✅ ROTable component with search and sort
- ✅ RODetailDialog showing full RO info
- ✅ UpdateStatusDialog for editing status

**Next:** [Phase 6: Main App](06-MAIN-APP.md)
