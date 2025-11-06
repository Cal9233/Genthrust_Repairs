# PHASE 4: REACT HOOKS (30 minutes)

## Step 4.1: Create RO Hook

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

## Key Concepts

### TanStack Query (React Query)
- Handles data fetching and caching
- Automatic background refetching
- Loading and error states
- Cache invalidation

### Hooks Overview

#### `useROs()`
- Fetches all repair orders from Excel
- Caches results for 5 minutes
- Auto-refreshes every minute
- Returns: `{ data, isLoading, error }`

#### `useUpdateROStatus()`
- Mutation hook to update RO status
- Invalidates cache after successful update
- Shows toast notification
- Returns: `{ mutate, isPending, error }`

#### `useDashboardStats()`
- Computes statistics from RO data
- Filters by status
- Calculates totals
- Returns: `{ data, isLoading, error }`

---

## Usage Examples

### Fetching Data
```typescript
const { data: ros, isLoading } = useROs();

if (isLoading) return <div>Loading...</div>;
```

### Updating Status
```typescript
const updateStatus = useUpdateROStatus();

updateStatus.mutate({
  rowIndex: 5,
  status: "APPROVED",
  notes: "Quote approved by customer"
});
```

### Dashboard Stats
```typescript
const { data: stats } = useDashboardStats();

console.log(`${stats.overdue} orders overdue`);
```

---

## Checkpoint

At this point you should have:

- ✅ Custom hook to fetch repair orders
- ✅ Custom hook to update statuses
- ✅ Custom hook to calculate dashboard stats
- ✅ Proper error handling and cache management
- ✅ Toast notifications

**Next:** [Phase 5: UI Components](05-UI-COMPONENTS.md)
